package com.consultationtool.Controller;

import java.util.Arrays;

// src/main/java/com/consultationtool/controller/LoginController.java
@Controller
public class LoginController {
    
    @GetMapping("/login")
    public String showLoginPage(Model model) {
        model.addAttribute("loginTypes", Arrays.asList("手机号", "QQ", "微信"));
        return "login";
    }
    
    @PostMapping("/login")
    public String handleLogin(@RequestParam String loginType, 
                            @RequestParam String username,
                            @RequestParam String password,
                            HttpSession session) {
        // 根据登录类型调用不同的服务
        switch(loginType) {
            case "手机号":
                // 调用手机号登录服务
                break;
            case "QQ":
                // 调用QQ登录服务
                break;
            case "微信":
                // 调用微信登录服务
                break;
        }
        
        // 登录成功后跳转到主界面
        return "redirect:/main";
    }
}