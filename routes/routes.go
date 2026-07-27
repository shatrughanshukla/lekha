package routes

import (
	"github.com/gin-gonic/gin"

	"mazu-banking-api/handlers"
)

// RegisterRoutes wires every entity's CRUD endpoints onto the Gin engine.
func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")

	users := api.Group("/users")
	{
		users.POST("", handlers.CreateUser)
		users.GET("", handlers.GetUsers)
		users.GET("/:id", handlers.GetUserByID)
		users.PUT("/:id", handlers.UpdateUser)
		users.DELETE("/:id", handlers.DeleteUser)
	}

	companies := api.Group("/companies")
	{
		companies.POST("", handlers.CreateCompany)
		companies.GET("", handlers.GetCompanies)
		companies.GET("/:id", handlers.GetCompanyByID)
		companies.PUT("/:id", handlers.UpdateCompany)
		companies.DELETE("/:id", handlers.DeleteCompany)
	}

	accounts := api.Group("/accounts")
	{
		accounts.POST("", handlers.CreateAccount)
		accounts.GET("", handlers.GetAccounts) // supports ?company_id=
		accounts.GET("/:id", handlers.GetAccountByID)
		accounts.PUT("/:id", handlers.UpdateAccount)
		accounts.DELETE("/:id", handlers.DeleteAccount)
	}

	transfers := api.Group("/transfers")
	{
		transfers.POST("", handlers.CreateTransfer)
		transfers.GET("", handlers.GetTransfers) // supports ?company_id= ?account_id= ?status=
		transfers.GET("/:id", handlers.GetTransferByID)
		transfers.PATCH("/:id/status", handlers.UpdateTransferStatus)
	}
}
