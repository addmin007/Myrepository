package com.consultationtool.dao;

import com.consultationtool.model.WechatUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WechatUserRepository extends JpaRepository<WechatUser, Long> {
    
    /**
     * 根据微信号查找用户
     */
    Optional<WechatUser> findByWechatId(String wechatId);
    
    /**
     * 根据微信号和密码查找用户
     */
    Optional<WechatUser> findByWechatIdAndPassword(String wechatId, String password);
    
    /**
     * 检查微信号是否存在
     */
    boolean existsByWechatId(String wechatId);
}
