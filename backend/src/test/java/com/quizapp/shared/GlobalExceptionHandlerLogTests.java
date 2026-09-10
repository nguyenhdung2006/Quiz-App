package com.quizapp.shared;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerLogTests {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void validationFailureUsesValidationLabelAndKeepsResponseContract(CapturedOutput output) {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "request");
        bindingResult.addError(new FieldError("request", "eng", "must not be blank"));

        var response = handler.handleValidation(new MethodArgumentNotValidException(null, bindingResult));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isEqualTo(ApiError.of(
                "Validation failed.",
                java.util.List.of("eng: must not be blank")
        ));
        assertThat(output.getAll()).contains("[VALIDATION] Validation failed");
        assertThat(output.getAll()).doesNotContain("[AUTH]");
    }

    @Test
    void malformedAndOtherBadRequestsUseRequestLabelAndKeepResponseContracts(CapturedOutput output) {
        var illegalArgumentResponse = handler.handleIllegalArgument(new IllegalArgumentException("Word not found."));
        var unreadableResponse = handler.handleUnreadableMessage(new HttpMessageNotReadableException(
                "Invalid JSON",
                new MockHttpInputMessage(new byte[0])
        ));

        assertThat(illegalArgumentResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(illegalArgumentResponse.getBody()).isEqualTo(ApiError.of(
                "Word not found.",
                java.util.List.of()
        ));
        assertThat(unreadableResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(unreadableResponse.getBody()).isEqualTo(ApiError.of(
                "Malformed request body.",
                java.util.List.of()
        ));
        assertThat(output.getAll())
                .contains("[REQUEST] Bad request")
                .contains("[REQUEST] Malformed request body")
                .doesNotContain("[AUTH]");
    }
}
