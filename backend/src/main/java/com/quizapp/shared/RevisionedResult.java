package com.quizapp.shared;

public record RevisionedResult<T>(T body, long revision) {
}
