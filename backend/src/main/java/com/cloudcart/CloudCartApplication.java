package com.cloudcart;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class CloudCartApplication {

    public static void main(String[] args) {
        SpringApplication.run(CloudCartApplication.class, args);
    }

    @Bean
    CommandLineRunner seedProducts(ProductRepository repository) {
        return args -> {

            if (repository.count() == 0) {

                repository.save(
                    new Product(
                        "CloudBook Pro",
                        999,
                        "Laptops"
                    )
                );

                repository.save(
                    new Product(
                        "CloudSound X1",
                        129,
                        "Audio"
                    )
                );

                repository.save(
                    new Product(
                        "CloudKeys Mechanical",
                        89,
                        "Keyboards"
                    )
                );

                repository.save(
                    new Product(
                        "CloudView 4K",
                        399,
                        "Monitors"
                    )
                );
            }
        };
    }
}

