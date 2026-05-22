package com.quizapp.user;

import java.time.LocalDate;

public record ProfileRequest(
        String name,
        String avatar,
        LocalDate birthday,
        String gender,
        String goal,
        String bio
) {
}
