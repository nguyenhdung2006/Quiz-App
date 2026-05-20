package com.quiz.word;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WordRepository extends JpaRepository<Word, Long> {
    boolean existsByEngIgnoreCase(String eng);

    Optional<Word> findByEngIgnoreCase(String eng);
}
