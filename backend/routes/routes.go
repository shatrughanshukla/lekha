package routes

import (
	"github.com/gin-gonic/gin"

	"lekha-api/handlers"
	"lekha-api/middleware"
)

// RegisterRoutes wires every route onto the Gin engine.
//
// /auth/signup and /auth/signin are public — that's how a user gets a token
// in the first place. Everything else requires a valid Bearer token.
func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")

	auth := api.Group("/auth")
	{
		auth.POST("/signup", handlers.SignUp)
		auth.POST("/signin", handlers.SignIn)
	}

	// Everything below this line requires Authorization: Bearer <token>
	protected := api.Group("")
	protected.Use(middleware.AuthRequired())

	protected.POST("/auth/refresh", handlers.RefreshToken) // extends an already-valid session; can't resurrect an expired one

	users := protected.Group("/users")
	{
		users.GET("", handlers.GetUsers)
		users.GET("/:id", handlers.GetUserByID)
		users.PUT("/:id", handlers.UpdateUser)
		users.DELETE("/:id", handlers.DeleteUser)
		users.POST("/:id/profile-picture", handlers.UploadProfilePicture)
		users.DELETE("/:id/profile-picture", handlers.RemoveProfilePicture)
		users.PATCH("/:id/password", handlers.ChangePassword)
	}

	companies := protected.Group("/companies")
	{
		companies.POST("", handlers.CreateCompany)
		companies.GET("", handlers.GetCompanies)
		companies.GET("/:id", handlers.GetCompanyByID)
		companies.PUT("/:id", handlers.UpdateCompany)
		companies.DELETE("/:id", handlers.DeleteCompany)
		companies.GET("/:id/transfers/summary", handlers.GetCompanyTransferSummary) // pure Go/SQL, no AI
		companies.GET("/:id/insights", handlers.GetCompanyInsights)                 // AI-phrased version of the above
		companies.GET("/:id/members", handlers.ListCompanyMembers)
		companies.POST("/:id/members", handlers.AddCompanyMember)
		companies.DELETE("/:id/members/:user_id", handlers.RemoveCompanyMember)
		companies.PATCH("/:id/members/:user_id", handlers.UpdateCompanyMemberRole)
	}

	insights := protected.Group("/insights")
	{
		insights.GET("/overview", handlers.GetOverviewInsights) // AI-phrased summary across every company the user belongs to
	}

	accounts := protected.Group("/accounts")
	{
		accounts.POST("", handlers.CreateAccount)
		accounts.GET("", handlers.GetAccounts) // supports ?company_id=
		accounts.GET("/:id", handlers.GetAccountByID)
		accounts.PUT("/:id", handlers.UpdateAccount)
		accounts.DELETE("/:id", handlers.DeleteAccount)
	}

	transfers := protected.Group("/transfers")
	{
		transfers.POST("", handlers.CreateTransfer)
		transfers.GET("", handlers.GetTransfers) // supports ?company_id= ?account_id= ?status=
		transfers.GET("/:id", handlers.GetTransferByID)
		transfers.PATCH("/:id/propose", handlers.ProposeTransferStatus)  // propose reversing a COMPLETED transfer
		transfers.DELETE("/:id/propose", handlers.WithdrawProposal)      // proposer takes back their own pending proposal
		transfers.PATCH("/:id/approval", handlers.RespondToTransfer)     // approve/reject whatever is awaiting a decision
		transfers.POST("/search", handlers.SearchTransfers)              // natural language search (AI layer)
	}
}
