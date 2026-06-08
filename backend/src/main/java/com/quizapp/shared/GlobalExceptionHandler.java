package com.quizapp.shared;

import com.quizapp.ai.AiRateLimitError;
import com.quizapp.ai.AiRateLimitExceededException;
import com.quizapp.vocab.SyncConflictResponse;
import com.quizapp.vocab.SyncRevisionConflictException;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        List<String> errors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .sorted(Comparator.comparing(error -> error.getField()))
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .toList();

        return ResponseEntity
                .badRequest()
                .body(ApiError.of("Validation failed.", errors));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity
                .badRequest()
                .body(ApiError.of(exception.getMessage(), List.of()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleUnreadableMessage(HttpMessageNotReadableException exception) {
        return ResponseEntity
                .badRequest()
                .body(ApiError.of("Malformed request body.", List.of()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException exception) {
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiError.of("Forbidden.", List.of(exception.getMessage())));
    }

    @ExceptionHandler(SyncRevisionConflictException.class)
    ResponseEntity<SyncConflictResponse> handleSyncRevisionConflict(SyncRevisionConflictException exception) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(SyncConflictResponse.revisionConflict(
                        exception.getExpectedRevision(),
                        exception.getCurrentRevision()
                ));
    }

    @ExceptionHandler(AiRateLimitExceededException.class)
    ResponseEntity<AiRateLimitError> handleAiRateLimit(AiRateLimitExceededException exception) {
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .body(AiRateLimitError.standard(exception.getRetryAfterSeconds()));
    }

    @ExceptionHandler(RuntimeException.class)
    ResponseEntity<ApiError> handleRuntime(RuntimeException exception) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("Something went wrong.", List.of()));
    }
}
