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

// Message represents the JSONB message structure
type Message struct {
	Type               string                 `json:"type"`
	Content            string                 `json:"content"`
	ToolCalls          []interface{}          `json:"tool_calls"`
	AdditionalKwargs   map[string]interface{} `json:"additional_kwargs"`
	ResponseMetadata   map[string]interface{} `json:"response_metadata"`
	InvalidToolCalls   []interface{}          `json:"invalid_tool_calls"`
}

// Chat represents a chat record with the new schema
type Chat struct {
	ID        int     `json:"id" db:"id"`
	SessionID string  `json:"sessionId" db:"session_id"`
	Message   Message `json:"message" db:"message"`
}

// ChatConversation represents a conversation with messages grouped by type
type ChatConversation struct {
	SessionID string    `json:"sessionId"`
	Messages  []Message `json:"messages"`
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

// Database connection
var db *sql.DB

func GetChatsHandler(w http.ResponseWriter, r *http.Request) {
	log.Info().
		Str("method", r.Method).
		Str("path", r.URL.Path).
		Str("query", r.URL.RawQuery).
		Str("referer", r.Referer()).
		Str("origin", r.Header.Get("Origin")).
		Msg("Request received")

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query()
	page, _ := strconv.Atoi(query.Get("page"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(query.Get("pageSize"))
	if pageSize < 1 || pageSize > 100 {
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

	searchTerm := strings.TrimSpace(query.Get("search"))
	offset := (page - 1) * pageSize

	if groupBy == "session" {
		handleSessionGrouping(w, page, pageSize, sortOrder, offset, searchTerm)
	} else {
		handleSimplePagination(w, page, pageSize, sortOrder, offset, searchTerm)
	}
}

func handleSimplePagination(w http.ResponseWriter, page, pageSize int, sortOrder string, offset int, searchTerm string) {
	orderClause := "id ASC"
	if sortOrder == "desc" {
		orderClause = "id DESC"
	}

	var chatsQuery string
	var args []interface{}
	if searchTerm != "" {
		chatsQuery = fmt.Sprintf(`
			SELECT id, session_id, message
			FROM n8n_chat_histories
			WHERE message::text ILIKE $3 OR session_id ILIKE $3
			ORDER BY %s
			LIMIT $1 OFFSET $2
		`, orderClause)
		args = []interface{}{pageSize, offset, "%" + searchTerm + "%"}
	} else {
		chatsQuery = fmt.Sprintf(`
			SELECT id, session_id, message
			FROM n8n_chat_histories
			ORDER BY %s
			LIMIT $1 OFFSET $2
		`, orderClause)
		args = []interface{}{pageSize, offset}
	}

	rows, err := db.Query(chatsQuery, args...)
	if err != nil {
		log.Err(err).Msg("Failed to query chats")
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var chats []Chat
	for rows.Next() {
		var chat Chat
		var messageJSON []byte

		if err := rows.Scan(&chat.ID, &chat.SessionID, &messageJSON); err != nil {
			log.Err(err).Msg("Failed to scan chat row")
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if err := json.Unmarshal(messageJSON, &chat.Message); err != nil {
			log.Err(err).Msg("Failed to unmarshal message JSON")
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		chats = append(chats, chat)
	}

	var totalCount int
	var countQuery string
	if searchTerm != "" {
		countQuery = `SELECT COUNT(*) FROM n8n_chat_histories WHERE message::text ILIKE $1 OR session_id ILIKE $1`
		err = db.QueryRow(countQuery, "%"+searchTerm+"%").Scan(&totalCount)
	} else {
		countQuery = `SELECT COUNT(*) FROM n8n_chat_histories`
		err = db.QueryRow(countQuery).Scan(&totalCount)
	}
	if err != nil {
		log.Err(err).Msg("Failed to count chats")
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	totalPages := (totalCount + pageSize - 1) / pageSize

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

func handleSessionGrouping(w http.ResponseWriter, page, pageSize int, sortOrder string, offset int, searchTerm string) {
	orderClause := "id ASC"
	if sortOrder == "desc" {
		orderClause = "id DESC"
	}

	var sessionQuery string
	var args []interface{}
	if searchTerm != "" {
		sessionQuery = `
			SELECT DISTINCT session_id
			FROM n8n_chat_histories
			WHERE message::text ILIKE $1 OR session_id ILIKE $1
			ORDER BY session_id
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{"%" + searchTerm + "%", pageSize, offset}
	} else {
		sessionQuery = `
			SELECT DISTINCT session_id
			FROM n8n_chat_histories
			ORDER BY session_id
			LIMIT $1 OFFSET $2
		`
		args = []interface{}{pageSize, offset}
	}

	rows, err := db.Query(sessionQuery, args...)
	if err != nil {
		log.Err(err).Msg("Failed to query sessions")
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sessionIDs []string
	for rows.Next() {
		var sessionID string
		if err := rows.Scan(&sessionID); err != nil {
			log.Err(err).Msg("Failed to scan session ID")
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		sessionIDs = append(sessionIDs, sessionID)
	}

	if len(sessionIDs) == 0 {
		respondWithJSON(w, APIResponse{
			Data:       map[string]*ChatConversation{},
			Pagination: PaginationResponse{Page: page, PageSize: pageSize, Total: 0, TotalPages: 0, GroupBy: "session"},
		})
		return
	}

	placeholders := make([]string, len(sessionIDs))
	sessionArgs := make([]interface{}, len(sessionIDs))
	for i, id := range sessionIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		sessionArgs[i] = id
	}

	chatsQuery := fmt.Sprintf(`
		SELECT id, session_id, message
		FROM n8n_chat_histories
		WHERE session_id IN (%s)
		ORDER BY %s
	`, strings.Join(placeholders, ","), orderClause)

	chatsRows, err := db.Query(chatsQuery, sessionArgs...)
	if err != nil {
		log.Err(err).Msg("Failed to query chats")
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer chatsRows.Close()

	groupedChats := make(map[string]*ChatConversation)
	for chatsRows.Next() {
		var chat Chat
		var messageJSON []byte

		if err := chatsRows.Scan(&chat.ID, &chat.SessionID, &messageJSON); err != nil {
			log.Err(err).Msg("Failed to scan chat row")
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		if err := json.Unmarshal(messageJSON, &chat.Message); err != nil {
			log.Err(err).Msg("Failed to unmarshal message JSON")
			respondWithError(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		if groupedChats[chat.SessionID] == nil {
			groupedChats[chat.SessionID] = &ChatConversation{
				SessionID: chat.SessionID,
				Messages:  []Message{},
			}
		}
		groupedChats[chat.SessionID].Messages = append(groupedChats[chat.SessionID].Messages, chat.Message)
	}

	var totalSessions int
	var countQuery string
	if searchTerm != "" {
		countQuery = `SELECT COUNT(DISTINCT session_id) FROM n8n_chat_histories WHERE message::text ILIKE $1 OR session_id ILIKE $1`
		err = db.QueryRow(countQuery, "%"+searchTerm+"%").Scan(&totalSessions)
	} else {
		countQuery = `SELECT COUNT(DISTINCT session_id) FROM n8n_chat_histories`
		err = db.QueryRow(countQuery).Scan(&totalSessions)
	}
	if err != nil {
		log.Err(err).Msg("Failed to count sessions")
		respondWithError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	totalPages := (totalSessions + pageSize - 1) / pageSize

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

// Initialize database connection
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
		log.Err(err).Msg("failed to open database connection")
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

func originCheckMiddleware(next http.Handler) http.Handler {
	allowedOrigin := os.Getenv("CHAT_URL") // e.g. "https://chats.n8n.hyperjump.tech"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		referer := r.Header.Get("Referer")

		if origin != "" && origin != allowedOrigin {
			http.Error(w, "Forbidden - invalid origin", http.StatusForbidden)
			return
		}

		if referer != "" && !strings.HasPrefix(referer, allowedOrigin) {
			http.Error(w, "Forbidden - invalid referer", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Main function
func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Warn().Msg("No .env file found or failed to load, using environment variables")
	} else {
		log.Info().Msg("Loaded .env file successfully")
	}

	if err := initDB(); err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer db.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/chats", GetChatsHandler)

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
		log.Fatal().Err(err).Msg("Server failed to start")
	}
}