package com.cloudcart;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ProductController {

    private final ProductRepository repository;

    public ProductController(ProductRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/api/products")
    public List<Product> products() {
        return repository.findAll();
    }

    @GetMapping("/api/products/{id}")
    public Product product(@PathVariable Long id) {
        return repository.findById(id)
                .orElseThrow();
    }
}


