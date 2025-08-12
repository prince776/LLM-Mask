package svc

import (
	"context"
	"github.com/go-chi/httprate"
	"llmmask/src/auth"
	"llmmask/src/confs"
	llm_proxy "llmmask/src/llm-proxy"
	"llmmask/src/log"
	"llmmask/src/models"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/render"
	cache "github.com/patrickmn/go-cache"
)

const (
	reqTimeout = time.Second * 60
)

var (
	frontendURLs = []string{
		"http://localhost:5173",
		"http://localhost:3000",
	}
)

type Service struct {
	port         int
	inMemCache   cache.Cache
	authManagers map[confs.ModelName]*auth.AuthManager
	llmProxy     *llm_proxy.LLMProxy
	dbHandler    *models.DBHandler
}

func NewService(
	port int,
	authManagers map[confs.ModelName]*auth.AuthManager,
	apiKeyManager *llm_proxy.APIKeyManager,
	dbHandler *models.DBHandler,
) *Service {
	return &Service{
		port:         port,
		inMemCache:   *cache.New(10*time.Minute, 20*time.Minute),
		authManagers: authManagers,
		llmProxy:     llm_proxy.NewLLMProxy(authManagers, apiKeyManager, dbHandler),
		dbHandler:    dbHandler,
	}
}

func (s *Service) Run() {
	r := chi.NewRouter()
	ctx := context.Background()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(CustomPanicHandler)
	r.Use(middleware.CleanPath)
	r.Use(s.RateLimitByUserMiddleware(confs.MaxRPSPerUser(ctx)))
	r.Use(httprate.LimitByRealIP(confs.MaxRPSPerIp(ctx), time.Second))
	// r.Use(middleware.Timeout(reqTimeout))

	// Set up CORS middleware options
	corsOptions := cors.Options{
		AllowedOrigins:   frontendURLs,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
		MaxAge:           300,
	}
	r.Use(cors.Handler(corsOptions))

	r.Get("/health", s.health)

	r.Route("/api/v1", func(r chi.Router) {
		// These apis will not be needed for relay servers. Really only needed for the api-server users interact
		// for normal operations, not the core LLM Interaction.
		r.Route("/users", func(r chi.Router) {
			r.Get("/signin", s.UserSignInHandler)
			r.Get("/grantGCP/callback", s.UserOAuthCallbackHandler)

			r.Route("/", func(r chi.Router) {
				r.Use(s.AuthMiddleware)
				r.Post("/signout", s.UserSignOutHandler)
			})
		})
		r.Route("/", func(r chi.Router) {
			r.Use(s.AuthMiddleware)
			r.Get("/me", s.GetCurrentUser)
			r.Post("/auth-token/{modelName}", s.GetSignedBlindedTokenHandler)
		})
		r.Post("/llm-proxy", s.LLMProxyHandler)
		r.Get("/model-pricing", s.GetModelPricingHandler)
	})

	// Serve React static files (from React build directory)
	staticDir := "./frontend/build"
	staticFileServer := http.FileServer(http.Dir(staticDir))
	r.Handle("/static/*", staticFileServer)

	// Fallback to serve index.html for all non-API and non-static file routes
	r.Handle("/*", ServeFileFallback(staticDir, staticFileServer))

	s.StartBackgroundJobs()
	err := http.ListenAndServe(":"+strconv.Itoa(s.port), r)
	if err != nil {
		log.Errorf(ctx, "Failed to start server: %v", err)
	}
}

func (s *Service) StartBackgroundJobs() {
	go func() {
		for {
			ctx := context.Background()
			startTime := time.Now()
			log.Infof(ctx, "Starting background jobs... (ts = %v)", startTime)
			// Do Work.

			endTime := time.Now()
			timeSpent := endTime.Sub(startTime)
			tts := time.Minute * 5
			if int64(tts) > int64(timeSpent) {
				tts = tts - timeSpent
			} else {
				tts = time.Minute
			}
			log.Infof(ctx, "Sleeping for %v seconds before next BG jobs run", tts)
			time.Sleep(tts)
		}
	}()
}

func (s *Service) health(w http.ResponseWriter, r *http.Request) {
	render.Render(w, r, Ok200("Happy"))
}

// CustomPanicHandler recovers from panics and sends a detailed JSON response
func CustomPanicHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				// log.Errorf(r.Context(), "Recovered from panic: %v\n%s", err, debug.Stack())

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)

				render.Render(w, r, ErrInternal(errors.Newf("Error: %v", err)))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Serve the index.html for SPA fallback routes
func ServeFileFallback(staticDir string, staticFileServer http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Serve the index.html for any route that doesn't match an API or static file
		if !isStaticFile(r.URL.Path) && !strings.HasPrefix(r.URL.Path, "/api") {
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
		} else {
			staticFileServer.ServeHTTP(w, r)
		}
	}
}

// Helper function to check if path matches static files
func isStaticFile(path string) bool {
	exts := []string{".css", ".js", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".ico"}
	for _, ext := range exts {
		if len(path) > len(ext) && path[len(path)-len(ext):] == ext {
			return true
		}
	}
	return false
}
