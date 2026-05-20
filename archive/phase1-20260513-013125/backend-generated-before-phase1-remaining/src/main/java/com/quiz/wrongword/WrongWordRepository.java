package com.quiz.wrongword;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WrongWordRepository extends JpaRepository<WrongWord, Long> {
    Optional<WrongWord> findByEngIgnoreCase(String eng);

    long deleteByMasteredTrue();
}
