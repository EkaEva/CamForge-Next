//! API 错误处理

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// API 错误类型
#[derive(Debug)]
pub enum ApiError {
    /// 参数错误
    BadRequest(String),
    /// 计算错误
    CalculationError(String),
    /// 内部错误
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::CalculationError(msg) => (StatusCode::UNPROCESSABLE_ENTITY, msg),
            ApiError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let body = Json(json!({
            "error": message,
            "status": status.as_u16(),
        }));

        (status, body).into_response()
    }
}

impl From<String> for ApiError {
    fn from(err: String) -> Self {
        ApiError::CalculationError(err)
    }
}