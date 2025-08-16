package com.consultationtool.model;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "qr_codes")
public class QRCode {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String qrCodeId;
    
    @Column(nullable = false)
    private String loginType; // phone, qq, wechat
    
    @Column(nullable = false)
    private String qrCodeData;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
    
    @Column(name = "scanned_at")
    private LocalDateTime scannedAt;
    
    @Column(name = "is_used")
    private Boolean isUsed = false;
    
    @Column(name = "user_id")
    private Long userId;
    
    @Column(name = "user_type")
    private String userType; // phone_user, qq_user, wechat_user
    
    // 构造函数
    public QRCode() {
        this.createdAt = LocalDateTime.now();
        this.expiresAt = LocalDateTime.now().plusMinutes(5); // 5分钟过期
    }
    
    public QRCode(String qrCodeId, String loginType, String qrCodeData) {
        this();
        this.qrCodeId = qrCodeId;
        this.loginType = loginType;
        this.qrCodeData = qrCodeData;
    }
    
    // Getter和Setter方法
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getQrCodeId() {
        return qrCodeId;
    }
    
    public void setQrCodeId(String qrCodeId) {
        this.qrCodeId = qrCodeId;
    }
    
    public String getLoginType() {
        return loginType;
    }
    
    public void setLoginType(String loginType) {
        this.loginType = loginType;
    }
    
    public String getQrCodeData() {
        return qrCodeData;
    }
    
    public void setQrCodeData(String qrCodeData) {
        this.qrCodeData = qrCodeData;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }
    
    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }
    
    public LocalDateTime getScannedAt() {
        return scannedAt;
    }
    
    public void setScannedAt(LocalDateTime scannedAt) {
        this.scannedAt = scannedAt;
    }
    
    public Boolean getIsUsed() {
        return isUsed;
    }
    
    public void setIsUsed(Boolean isUsed) {
        this.isUsed = isUsed;
    }
    
    public Long getUserId() {
        return userId;
    }
    
    public void setUserId(Long userId) {
        this.userId = userId;
    }
    
    public String getUserType() {
        return userType;
    }
    
    public void setUserType(String userType) {
        this.userType = userType;
    }
    
    // 检查二维码是否过期
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(this.expiresAt);
    }
    
    // 检查二维码是否可用
    public boolean isAvailable() {
        return !this.isUsed && !this.isExpired();
    }
}


