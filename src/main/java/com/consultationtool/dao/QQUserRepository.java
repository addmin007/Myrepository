package com.consultationtool.dao;

import com.consultationtool.model.QQUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface QQUserRepository extends JpaRepository<QQUser, Long> {
    
    /**
     * 根据QQ号查找用户
     */
    Optional<QQUser> findByQqNumber(String qqNumber);
    
    /**
     * 根据QQ号和密码查找用户
     */
    Optional<QQUser> findByQqNumberAndPassword(String qqNumber, String password);
    
    /**
     * 检查QQ号是否存在
     */
    boolean existsByQqNumber(String qqNumber);
}
