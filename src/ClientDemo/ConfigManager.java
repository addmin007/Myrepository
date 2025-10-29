package ClientDemo;

import java.io.*;
import java.util.Properties;

/**
 * 配置管理器
 * 用于保存和加载应用程序配置信息
 */
public class ConfigManager {
    
    private static final String CONFIG_FILE = "config.properties";
    private Properties properties;
    
    // 配置键名
    private static final String KEY_IP_ADDRESS = "ip.address";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_PASSWORD = "password";
    private static final String KEY_PORT = "port";
    
    // 默认值
    private static final String DEFAULT_IP = "10.17.36.31";
    private static final String DEFAULT_USERNAME = "admin";
    private static final String DEFAULT_PASSWORD = "hik12345";
    private static final String DEFAULT_PORT = "8000";
    
    public ConfigManager() {
        properties = new Properties();
        loadConfig();
    }
    
    /**
     * 加载配置文件
     */
    private void loadConfig() {
        File configFile = new File(CONFIG_FILE);
        if (configFile.exists()) {
            try (FileInputStream fis = new FileInputStream(configFile)) {
                properties.load(fis);
                System.out.println("配置文件加载成功: " + CONFIG_FILE);
            } catch (IOException e) {
                System.err.println("加载配置文件失败: " + e.getMessage());
                setDefaultValues();
            }
        } else {
            System.out.println("配置文件不存在，使用默认值");
            setDefaultValues();
        }
    }
    
    /**
     * 设置默认值
     */
    private void setDefaultValues() {
        properties.setProperty(KEY_IP_ADDRESS, DEFAULT_IP);
        properties.setProperty(KEY_USERNAME, DEFAULT_USERNAME);
        properties.setProperty(KEY_PASSWORD, DEFAULT_PASSWORD);
        properties.setProperty(KEY_PORT, DEFAULT_PORT);
    }
    
    /**
     * 保存配置到文件
     */
    public void saveConfig() {
        try (FileOutputStream fos = new FileOutputStream(CONFIG_FILE)) {
            properties.store(fos, "ClientDemo Configuration");
            System.out.println("配置保存成功: " + CONFIG_FILE);
        } catch (IOException e) {
            System.err.println("保存配置文件失败: " + e.getMessage());
        }
    }
    
    /**
     * 获取IP地址
     */
    public String getIpAddress() {
        return properties.getProperty(KEY_IP_ADDRESS, DEFAULT_IP);
    }
    
    /**
     * 设置IP地址
     */
    public void setIpAddress(String ipAddress) {
        properties.setProperty(KEY_IP_ADDRESS, ipAddress);
    }
    
    /**
     * 获取用户名
     */
    public String getUsername() {
        return properties.getProperty(KEY_USERNAME, DEFAULT_USERNAME);
    }
    
    /**
     * 设置用户名
     */
    public void setUsername(String username) {
        properties.setProperty(KEY_USERNAME, username);
    }
    
    /**
     * 获取密码
     */
    public String getPassword() {
        return properties.getProperty(KEY_PASSWORD, DEFAULT_PASSWORD);
    }
    
    /**
     * 设置密码
     */
    public void setPassword(String password) {
        properties.setProperty(KEY_PASSWORD, password);
    }
    
    /**
     * 获取端口
     */
    public String getPort() {
        return properties.getProperty(KEY_PORT, DEFAULT_PORT);
    }
    
    /**
     * 设置端口
     */
    public void setPort(String port) {
        properties.setProperty(KEY_PORT, port);
    }
    
    /**
     * 保存当前配置
     */
    public void saveCurrentConfig(String ipAddress, String username, String password, String port) {
        setIpAddress(ipAddress);
        setUsername(username);
        setPassword(password);
        setPort(port);
        saveConfig();
    }
}
