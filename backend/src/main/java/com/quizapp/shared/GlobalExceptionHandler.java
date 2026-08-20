package com.quizapp.shared;

import com.quizapp.ai.AiRateLimitError;
import com.quizapp.ai.AiRateLimitExceededException;
import com.quizapp.health.HealthCounterService;
import com.quizapp.vocab.SyncConflictResponse;
import com.quizapp.vocab.SyncClientUpgradeRequiredException;
import com.quizapp.vocab.SyncClientUpgradeResponse;
import com.quizapp.vocab.SyncRevisionConflictException;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Autowired(required = false)
    private HealthCounterService healthCounters;

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        log.warn("[VALIDATION] Validation failed: {}",
                exception.getBindingResult().getFieldErrors().stream()
                        .map(e -> e.getField() + ": " + e.getDefaultMessage())
                        .toList());
        if (healthCounters != null) healthCounters.incrementValidationErrors();
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
        log.warn("[REQUEST] Bad request: {}", exception.getMessage());
        if (healthCounters != null) healthCounters.incrementValidationErrors();
        return ResponseEntity
                .badRequest()
                .body(ApiError.of(exception.getMessage(), List.of()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleUnreadableMessage(HttpMessageNotReadableException exception) {
        log.warn("[REQUEST] Malformed request body: type={}", exception.getClass().getSimpleName());
        if (healthCounters != null) healthCounters.incrementValidationErrors();
        return ResponseEntity
                .badRequest()
                .body(ApiError.of("Malformed request body.", List.of()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException exception) {
        log.warn("[AUTH] Access denied: {}", exception.getMessage());
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiError.of("Forbidden.", List.of(exception.getMessage())));
    }

    @ExceptionHandler(SyncRevisionConflictException.class)
    ResponseEntity<SyncConflictResponse> handleSyncRevisionConflict(SyncRevisionConflictException exception) {
        log.warn("[SYNC] Revision conflict: expected={} actual={}",
                exception.getExpectedRevision(), exception.getCurrentRevision());
        if (healthCounters != null) healthCounters.incrementSyncConflicts();
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(SyncConflictResponse.revisionConflict(
                        exception.getExpectedRevision(),
                        exception.getCurrentRevision()
                ));
    }

    @ExceptionHandler(SyncClientUpgradeRequiredException.class)
    ResponseEntity<SyncClientUpgradeResponse> handleSyncClientUpgradeRequired(
            SyncClientUpgradeRequiredException exception
    ) {
        log.warn("[SYNC] Client upgrade required: {}", exception.getMessage());
        if (healthCounters != null) healthCounters.incrementValidationErrors();
        return ResponseEntity
                .badRequest()
                .body(SyncClientUpgradeResponse.standard());
    }

    @ExceptionHandler(AiRateLimitExceededException.class)
    ResponseEntity<AiRateLimitError> handleAiRateLimit(AiRateLimitExceededException exception) {
        log.warn("[AI] Rate limit exceeded: retryAfter={}s", exception.getRetryAfterSeconds());
        if (healthCounters != null) healthCounters.incrementRateLimitHits();
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .body(AiRateLimitError.standard(exception.getRetryAfterSeconds()));
    }

    @ExceptionHandler(RuntimeException.class)
    ResponseEntity<ApiError> handleRuntime(RuntimeException exception) {
        log.error("[ERROR] Unhandled exception: type={} message={}", exception.getClass().getSimpleName(),
                exception.getMessage(), exception);
        if (healthCounters != null) healthCounters.incrementServerErrors();
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("Something went wrong.", List.of()));
    }
}
