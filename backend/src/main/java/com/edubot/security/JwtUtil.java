package com.edubot.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JwtUtil — genera y valida tokens JWT para el panel de EduBot.
 *
 * El token incluye: username, rol (DOCENTE / ADMINISTRATIVO) y docenteId
 * cuando aplica. El backend lo verifica en cada request al panel.
 */
@Component
public class JwtUtil {

    @Value("${edubot.jwt.secret:EduBotSecretKeyMuyLargaParaQueSeaSegura2024!}")
    private String secret;

    @Value("${edubot.jwt.expiration-ms:86400000}") // 24 horas por defecto
    private long expirationMs;

    private SecretKey getKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT secret demasiado corto — mínimo 32 caracteres");
        }
        return Keys.hmacShaKeyFor(keyBytes);
    }

    
    public String generarToken(String username, String rol, Long docenteId) {
        JwtBuilder builder = Jwts.builder()
                .subject(username)
                .claim("rol", rol)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getKey());

        if (docenteId != null) {
            builder.claim("docenteId", docenteId);
        }

        return builder.compact();
    }

    /** Extrae el username del token */
    public String extraerUsername(String token) {
        return parsear(token).getPayload().getSubject();
    }

    /** Extrae el rol del token */
    public String extraerRol(String token) {
        return (String) parsear(token).getPayload().get("rol");
    }

    /** Extrae el docenteId del token (null si es ADMINISTRATIVO) */
    public Long extraerDocenteId(String token) {
        Object val = parsear(token).getPayload().get("docenteId");
        if (val == null) return null;
        return ((Number) val).longValue();
    }

    /** Valida que el token sea auténtico y no esté expirado */
    public boolean esValido(String token) {
        try {
            parsear(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Jws<Claims> parsear(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token);
    }
}
