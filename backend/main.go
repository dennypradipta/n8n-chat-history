package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq" // PostgreSQL driver
	"github.com/rs/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Chat represents a chat record
type Chat struct {
	ID          string    `json:"id" db:"id"`
	SessionID   string    `json:"sessionId" db:"session_id"`
	AIMessage   string    `json:"aiMessage" db:"ai_message"`
	UserMessage string    `json:"userMessage" db:"user_message"`
	Workflow    string    `json:"workflow" db:"workflow"`
	WorkflowID  string    `json:"workflowId" db:"workflow_id"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// Session represents a session with sessionId
type Session struct {
	SessionID string `json:"sessionId" db:"session_id"`
}

// PaginationResponse represents the pagination metadata
type PaginationResponse struct {
	Page       int    `json:"page"`
	PageSize   int    `json:"pageSize"`
	Total      int    `json:"total"`
	TotalPages int    `json:"totalPages"`
	GroupBy    string `json:"groupBy"`
}

// APIResponse represents the API response structure
type APIResponse struct {
	Data       interface{}        `json:"data"`
	Pagination PaginationResponse `json:"pagination"`
}

// ErrorResponse represents error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// Database connection (initialize this in your main function or init)
var db *sql.DB

func GetChatsHandler(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("method", r.Method).Str("path", r.URL.Path).Str("query", r.URL.RawQuery).Str("referer", r.Referer()).Str("origin", r.Header.Get("Origin")).Msg("Request received")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse query parameters
	query := r.URL.Query()

	page, err := strconv.Atoi(query.Get("page"))
	if err != nil || page == 0 {
		page = 1
	}

	pageSize, err := strconv.Atoi(query.Get("pageSize"))
	if err != nil || pageSize == 0 {
		pageSize = 10
	}

	sortOrder := query.Get("sortOrder")
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "asc"
	}

	groupBy := query.Get("groupBy")
	if groupBy == "" {
		groupBy = "simple"
	}

	// Validate parameters
	if page < 1 {
		respondWithError(w, "Page must be greater than 0", http.StatusBadRequest)
		return
	}

	if pageSize < 1 || pageSize > 100 {
		respondWithError(w, "Page size must be between 1 and 100", http.StatusBadRequest)
		return
	}

	offset := (page - 1) * pageSize

	if groupBy == "session" {
		handleSessionGrouping(w, page, pageSize, sortOrder, offset)
	} else {
		handleSimplePagination(w, page, pageSize, sortOrder, offset)
	}
}

func handleSessionGrouping(w http.ResponseWriter, page, pageSize int, sortOrder string, offset int) {
	// Get distinct session IDs with pagination
	sessionQuery := `
		SELECT DISTINCT session_id 
		FROM chats 
		LIMIT $1 OFFSET $2
	`

	rows, err := db.Query(sessionQuery, pageSize, offset)
	if err != nil {
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sessionIDs []string
	for rows.Next() {
		var sessionID string
		if err := rows.Scan(&sessionID); err != nil {
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		sessionIDs = append(sessionIDs, sessionID)
	}

	if len(sessionIDs) == 0 {
		response := APIResponse{
			Data: make(map[string][]Chat),
			Pagination: PaginationResponse{
				Page:       page,
				PageSize:   pageSize,
				Total:      0,
				TotalPages: 0,
				GroupBy:    "session",
			},
		}
		respondWithJSON(w, response)
		return
	}

	// Create placeholders for IN clause
	placeholders := make([]string, len(sessionIDs))
	args := make([]interface{}, len(sessionIDs))
	for i, id := range sessionIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	// Get all chats for these sessions
	orderClause := "created_at ASC"
	if sortOrder == "desc" {
		orderClause = "created_at DESC"
	}

	chatsQuery := fmt.Sprintf(`
		SELECT id, session_id, ai_message, user_message, workflow, workflow_id, created_at, updated_at
		FROM chats 
		WHERE session_id IN (%s) 
		ORDER BY %s, session_id
	`, strings.Join(placeholders, ","), orderClause)

	chatsRows, err := db.Query(chatsQuery, args...)
	if err != nil {
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer chatsRows.Close()

	// Group chats by session ID
	groupedChats := make(map[string][]Chat)
	for chatsRows.Next() {
		var chat Chat
		if err := chatsRows.Scan(&chat.ID, &chat.SessionID, &chat.AIMessage, &chat.UserMessage, &chat.Workflow, &chat.WorkflowID, &chat.CreatedAt, &chat.UpdatedAt); err != nil {
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		groupedChats[chat.SessionID] = append(groupedChats[chat.SessionID], chat)
	}

	// Get total session count for pagination
	var totalSessions int
	countQuery := "SELECT COUNT(DISTINCT session_id) FROM chats"
	if err := db.QueryRow(countQuery).Scan(&totalSessions); err != nil {
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	totalPages := (totalSessions + pageSize - 1) / pageSize // Ceiling division

	response := APIResponse{
		Data: groupedChats,
		Pagination: PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      totalSessions,
			TotalPages: totalPages,
			GroupBy:    "session",
		},
	}

	respondWithJSON(w, response)
}

func handleSimplePagination(w http.ResponseWriter, page, pageSize int, sortOrder string, offset int) {
	// Get chats with simple pagination
	orderClause := "created_at ASC"
	if sortOrder == "desc" {
		orderClause = "created_at DESC"
	}

	chatsQuery := fmt.Sprintf(`
SELECT id, session_id, ai_message, user_message, workflow, workflow_id, created_at, updated_at
		FROM chats 
		ORDER BY %s 
		LIMIT $1 OFFSET $2
	`, orderClause)

	rows, err := db.Query(chatsQuery, pageSize, offset)
	if err != nil {
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		log.Err(err).Msg("Failed to query chats")
		return
	}
	defer rows.Close()

	var chats []Chat
	for rows.Next() {
		var chat Chat
		if err := rows.Scan(&chat.ID, &chat.SessionID, &chat.AIMessage, &chat.UserMessage, &chat.Workflow, &chat.WorkflowID, &chat.CreatedAt, &chat.UpdatedAt); err != nil {
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			log.Err(err).Msg("Failed to query chats")
			return
		}
		chats = append(chats, chat)
	}

	// Get total count for pagination
	var totalCount int
	countQuery := "SELECT COUNT(*) FROM chats"
	if err := db.QueryRow(countQuery).Scan(&totalCount); err != nil {
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		log.Err(err).Msg("Failed to query chats")
		return
	}

	totalPages := (totalCount + pageSize - 1) / pageSize // Ceiling division

	response := APIResponse{
		Data: chats,
		Pagination: PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      totalCount,
			TotalPages: totalPages,
			GroupBy:    "simple",
		},
	}

	respondWithJSON(w, response)
}

func respondWithJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func respondWithError(w http.ResponseWriter, message string, statusCode int) {
	log.Error().Str("error", message).Int("statusCode", statusCode).Msg("Request error")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

// Example of how to initialize the database connection
func initDB() error {
	var err error

	// Read database URL from environment variable
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Fallback to individual environment variables if DATABASE_URL is not set
		host := getEnvOrDefault("DB_HOST", "localhost")
		port := getEnvOrDefault("DB_PORT", "5432")
		user := getEnvOrDefault("DB_USER", "postgres")
		password := getEnvOrDefault("DB_PASSWORD", "")
		dbname := getEnvOrDefault("DB_NAME", "postgres")
		sslmode := getEnvOrDefault("DB_SSLMODE", "disable")

		dbURL = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			host, port, user, password, dbname, sslmode)
	}

	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Err(err).Msg("failed to open database connection: %w")
		return err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err = db.Ping(); err != nil {
		log.Err(err).Msg("failed to ping database")
		return err
	}

	log.Info().Msg("Database connection established successfully")
	return nil
}

// getEnvOrDefault returns the value of the environment variable or a default value
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ChatStatsResponse represents the stats response structure
type ChatStatsResponse struct {
	Data ChatStats `json:"data"`
}

// ChatStats represents chat statistics
type ChatStats struct {
	Daily   int `json:"daily"`
	Monthly int `json:"monthly"`
	Yearly  int `json:"yearly"`
	AllTime int `json:"allTime"`
}

func GetChatStatsHandler(w http.ResponseWriter, r *http.Request) {
	log.Info().Str("method", r.Method).Str("path", r.URL.Path).Str("query", r.URL.RawQuery).Str("referer", r.Referer()).Str("origin", r.Header.Get("Origin")).Msg("Request received")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	now := time.Now()

	// Calculate time boundaries
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	startOfYear := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())

	// Create channels for concurrent queries
	type countResult struct {
		count int
		err   error
	}

	dailyCh := make(chan countResult, 1)
	monthlyCh := make(chan countResult, 1)
	yearlyCh := make(chan countResult, 1)
	allTimeCh := make(chan countResult, 1)

	// Execute queries concurrently
	go func() {
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM chats WHERE created_at >= $1", startOfToday).Scan(&count)
		dailyCh <- countResult{count: count, err: err}
	}()

	go func() {
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM chats WHERE created_at >= $1", startOfMonth).Scan(&count)
		monthlyCh <- countResult{count: count, err: err}
	}()

	go func() {
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM chats WHERE created_at >= $1", startOfYear).Scan(&count)
		yearlyCh <- countResult{count: count, err: err}
	}()

	go func() {
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM chats").Scan(&count)
		allTimeCh <- countResult{count: count, err: err}
	}()

	// Collect results
	dailyResult := <-dailyCh
	monthlyResult := <-monthlyCh
	yearlyResult := <-yearlyCh
	allTimeResult := <-allTimeCh

	// Check for errors
	if dailyResult.err != nil || monthlyResult.err != nil || yearlyResult.err != nil || allTimeResult.err != nil {
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	stats := ChatStats{
		Daily:   dailyResult.count,
		Monthly: monthlyResult.count,
		Yearly:  yearlyResult.count,
		AllTime: allTimeResult.count,
	}

	response := ChatStatsResponse{
		Data: stats,
	}

	respondWithJSON(w, response)
}

func originCheckMiddleware(next http.Handler) http.Handler {
	allowedOrigin := os.Getenv("CHAT_URL") // e.g. "https://chats.n8n.hyperjump.tech"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin == "" || origin != allowedOrigin {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Example main function
func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	// Load .env file if it exists (optional - won't fail if file doesn't exist)
	if err := godotenv.Load(); err != nil {
		log.Warn().Msg("No .env file found or failed to load, using environment variables")
	} else {
		log.Info().Msg("Loaded .env file successfully")
	}

	if err := initDB(); err != nil {
		log.Err(err).Msgf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/chats", GetChatsHandler)
	mux.HandleFunc("/api/stats", GetChatStatsHandler)

	port := getEnvOrDefault("PORT", "8080")
	chatURL := os.Getenv("CHAT_URL")

	secureMux := originCheckMiddleware(mux)
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{chatURL},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: true,
	})

	handler := corsHandler.Handler(secureMux)

	log.Info().Msgf("Server starting on port %s", port)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal().Err(err).Msgf("Server failed to start: %v", err)
	}
}
