package com.quiz.wrongword;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/wrong-words")
public class WrongWordController {
    private final WrongWordService service;

    public WrongWordController(WrongWordService service) {
        this.service = service;
    }

    @GetMapping
    List<WrongWord> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    WrongWord upsert(@Valid @RequestBody WrongWordRequest request) {
        return service.upsert(request);
    }

    @PatchMapping("/{id}/mastered")
    WrongWord markMastered(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        return service.markMastered(id, Boolean.TRUE.equals(body.get("mastered")));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @DeleteMapping("/mastered")
    Map<String, Long> clearMastered() {
        return Map.of("deleted", service.clearMastered());
    }
}
