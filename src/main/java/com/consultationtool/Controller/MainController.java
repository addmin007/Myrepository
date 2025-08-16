package com.consultationtool.Controller;

import java.util.Map;

// src/main/java/com/consultationtool/controller/MainController.java
@Controller
public class MainController {
    
    @GetMapping("/main")
    public String showMainPage(Model model) {
        // 加载用户数据
        model.addAttribute("accounts", accountService.getAllAccounts());
        model.addAttribute("products", productService.getAllProducts());
        model.addAttribute("messages", messageService.getAllMessages());
        return "main";
    }
    
    @PostMapping("/importAccounts")
    public String importAccounts(@RequestParam("file") MultipartFile file) {
        accountService.importAccountsFromFile(file);
        return "redirect:/main";
    }
    
    @PostMapping("/importProducts")
    public String importProducts(@RequestParam("file") MultipartFile file) {
        productService.importProductsFromFile(file);
        return "redirect:/main";
    }
    
    @PostMapping("/startConsultation")
    public String startConsultation(@RequestParam Map<String, String> params) {
        consultationService.startBatchConsultation(params);
        return "redirect:/main";
    }
    
    @GetMapping("/checkResponses")
    @ResponseBody
    public List<ResponseResult> checkResponses() {
        return consultationService.checkSellerResponses();
    }
}