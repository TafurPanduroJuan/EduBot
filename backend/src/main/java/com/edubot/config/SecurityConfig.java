package com.edubot.config;

import com.edubot.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * SecurityConfig — define qué rutas son públicas y cuáles requieren rol.
 *
 * Rutas públicas (sin token):
 *   POST /api/panel/auth/login
 *   GET  /api/edubot/**  (chatbot WhatsApp — acceso público)
 *   POST /api/edubot/**
 *
 * Rutas solo DOCENTE:
 *   GET/PUT /api/panel/docente/**
 *
 * Rutas solo ADMINISTRATIVO:
 *   GET/POST /api/panel/admin/**
 *
 * El backend valida el rol — el frontend no puede saltarse esta protección.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${edubot.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .cors(c -> c.configurationSource(corsSource()))
            .authorizeHttpRequests(auth -> auth

                // ── Rutas públicas ──────────────────────────────────────
                .requestMatchers("/api/panel/auth/**").permitAll()
                .requestMatchers("/api/edubot/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()

                // ── Solo DOCENTE ────────────────────────────────────────
                .requestMatchers(HttpMethod.GET,  "/api/panel/docente/**").hasRole("DOCENTE")
                .requestMatchers(HttpMethod.POST, "/api/panel/docente/**").hasRole("DOCENTE")
                .requestMatchers(HttpMethod.PUT,  "/api/panel/docente/**").hasRole("DOCENTE")
                .requestMatchers(HttpMethod.DELETE,"/api/panel/docente/**").hasRole("DOCENTE")

                // ── Solo ADMINISTRATIVO ─────────────────────────────────
                .requestMatchers("/api/panel/admin/**").hasRole("ADMINISTRATIVO")

                // ── Cualquier otro request autenticado ──────────────────
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
