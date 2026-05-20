package com.quiz.word;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/words")
public class WordController {
    private final WordService service;

    public WordController(WordService service) {
        this.service = service;
    }

    @GetMapping
    List<Word> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    Word create(@Valid @RequestBody WordRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    Word update(@PathVariable Long id, @Valid @RequestBody WordRequest request) {
        return service.update(id, request);
    }

    @PatchMapping("/{id}/favorite")
    Word toggleFavorite(@PathVariable Long id) {
        return service.toggleFavorite(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
