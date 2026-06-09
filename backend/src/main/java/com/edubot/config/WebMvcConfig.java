package com.edubot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * WebMvcConfig — configuración adicional de Spring MVC.
 *
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${edubot.actas.directorio:actas}")
    private String directorioActas;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Servir los PDFs generados en /actas/** desde el directorio configurado
        String rutaAbsoluta = Paths.get(directorioActas).toAbsolutePath().toString();
        registry.addResourceHandler("/actas/**")
            .addResourceLocations("file:" + rutaAbsoluta + "/");
    }
}
