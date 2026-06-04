package com.quizapp.user;

import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record ProfileRequest(
        @Size(max = 120, message = "Name must be 120 characters or less.")
        String name,

        @Size(max = 100_000, message = "Avatar data must be 100000 characters or less.")
        String avatar,

        @PastOrPresent(message = "Birthday cannot be in the future.")
        LocalDate birthday,

        @Size(max = 40, message = "Gender must be 40 characters or less.")
        String gender,

        @Size(max = 160, message = "Learning goal must be 160 characters or less.")
        String goal,

        @Size(max = 2_000, message = "Bio must be 2000 characters or less.")
        String bio
) {
}
