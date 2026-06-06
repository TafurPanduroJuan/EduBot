package com.edubot;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EdubotApplication {
    public static void main(String[] args) {
        SpringApplication.run(EdubotApplication.class, args);
    }
}
