package com.consultationtool.dao;

import com.consultationtool.model.PhoneUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PhoneUserRepository extends JpaRepository<PhoneUser, Long> {
    
    /**
     * 根据手机号查找用户
     */
    Optional<PhoneUser> findByPhoneNumber(String phoneNumber);
    
    /**
     * 根据手机号和密码查找用户
     */
    Optional<PhoneUser> findByPhoneNumberAndPassword(String phoneNumber, String password);
    
    /**
     * 检查手机号是否存在
     */
    boolean existsByPhoneNumber(String phoneNumber);
}


