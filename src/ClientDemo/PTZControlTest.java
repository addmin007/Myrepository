package ClientDemo;

import javax.swing.*;
import java.awt.*;

/**
 * 云台控制功能测试程序
 * 用于验证云台控制按钮的功能实现
 */
public class PTZControlTest extends JFrame {
    
    public PTZControlTest() {
        initComponents();
    }
    
    private void initComponents() {
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setTitle("云台控制功能测试");
        setSize(400, 500);
        setLocationRelativeTo(null);
        
        // 创建主面板
        JPanel mainPanel = new JPanel();
        mainPanel.setLayout(new BorderLayout());
        
        // 创建云台控制面板
        JPanel ptzPanel = new JPanel();
        ptzPanel.setBorder(BorderFactory.createTitledBorder("云台控制测试"));
        ptzPanel.setLayout(new GridBagLayout());
        
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        
        // 方向控制按钮
        JButton upBtn = new JButton("↑");
        upBtn.setFont(new Font("宋体", Font.BOLD, 16));
        upBtn.setPreferredSize(new Dimension(50, 50));
        upBtn.addActionListener(e -> System.out.println("测试：云台向上移动"));
        
        JButton downBtn = new JButton("↓");
        downBtn.setFont(new Font("宋体", Font.BOLD, 16));
        downBtn.setPreferredSize(new Dimension(50, 50));
        downBtn.addActionListener(e -> System.out.println("测试：云台向下移动"));
        
        JButton leftBtn = new JButton("←");
        leftBtn.setFont(new Font("宋体", Font.BOLD, 16));
        leftBtn.setPreferredSize(new Dimension(50, 50));
        leftBtn.addActionListener(e -> System.out.println("测试：云台向左移动"));
        
        JButton rightBtn = new JButton("→");
        rightBtn.setFont(new Font("宋体", Font.BOLD, 16));
        rightBtn.setPreferredSize(new Dimension(50, 50));
        rightBtn.addActionListener(e -> System.out.println("测试：云台向右移动"));
        
        JButton stopBtn = new JButton("停止");
        stopBtn.setPreferredSize(new Dimension(50, 50));
        stopBtn.addActionListener(e -> System.out.println("测试：云台停止"));
        
        // 变焦控制按钮
        JButton zoomInBtn = new JButton("放大");
        zoomInBtn.setPreferredSize(new Dimension(70, 35));
        zoomInBtn.addActionListener(e -> System.out.println("测试：云台放大"));
        
        JButton zoomOutBtn = new JButton("缩小");
        zoomOutBtn.setPreferredSize(new Dimension(70, 35));
        zoomOutBtn.addActionListener(e -> System.out.println("测试：云台缩小"));
        
        // 预置位控制按钮
        JButton preset1Btn = new JButton("预置1");
        preset1Btn.setPreferredSize(new Dimension(70, 35));
        preset1Btn.addActionListener(e -> System.out.println("测试：云台预置位1"));
        
        JButton preset2Btn = new JButton("预置2");
        preset2Btn.setPreferredSize(new Dimension(70, 35));
        preset2Btn.addActionListener(e -> System.out.println("测试：云台预置位2"));
        
        JButton preset3Btn = new JButton("预置3");
        preset3Btn.setPreferredSize(new Dimension(70, 35));
        preset3Btn.addActionListener(e -> System.out.println("测试：云台预置位3"));
        
        // 布局方向控制按钮（十字形）
        gbc.gridx = 1; gbc.gridy = 0;
        ptzPanel.add(upBtn, gbc);
        
        gbc.gridx = 0; gbc.gridy = 1;
        ptzPanel.add(leftBtn, gbc);
        
        gbc.gridx = 1; gbc.gridy = 1;
        ptzPanel.add(stopBtn, gbc);
        
        gbc.gridx = 2; gbc.gridy = 1;
        ptzPanel.add(rightBtn, gbc);
        
        gbc.gridx = 1; gbc.gridy = 2;
        ptzPanel.add(downBtn, gbc);
        
        // 布局变焦控制按钮
        gbc.gridx = 0; gbc.gridy = 3;
        gbc.gridwidth = 3;
        ptzPanel.add(Box.createVerticalStrut(15), gbc);
        
        gbc.gridwidth = 1;
        gbc.gridx = 0; gbc.gridy = 4;
        ptzPanel.add(zoomInBtn, gbc);
        
        gbc.gridx = 2; gbc.gridy = 4;
        ptzPanel.add(zoomOutBtn, gbc);
        
        // 布局预置位控制按钮
        gbc.gridx = 0; gbc.gridy = 5;
        ptzPanel.add(Box.createVerticalStrut(10), gbc);
        
        gbc.gridx = 0; gbc.gridy = 6;
        ptzPanel.add(preset1Btn, gbc);
        
        gbc.gridx = 1; gbc.gridy = 6;
        ptzPanel.add(preset2Btn, gbc);
        
        gbc.gridx = 2; gbc.gridy = 6;
        ptzPanel.add(preset3Btn, gbc);
        
        // 添加说明文本
        JTextArea infoArea = new JTextArea(8, 30);
        infoArea.setEditable(false);
        infoArea.setText("云台控制功能测试说明：\n\n" +
                        "1. 方向控制：↑↓←→ 按钮控制云台移动方向\n" +
                        "2. 停止按钮：停止所有方向的移动\n" +
                        "3. 变焦控制：放大/缩小按钮控制镜头变焦\n" +
                        "4. 预置位：预置1/2/3按钮转到对应预置位\n\n" +
                        "注意：实际功能需要连接海康威视设备并开始预览\n" +
                        "点击按钮会在控制台输出相应的测试信息");
        infoArea.setBackground(getBackground());
        
        mainPanel.add(ptzPanel, BorderLayout.CENTER);
        mainPanel.add(new JScrollPane(infoArea), BorderLayout.SOUTH);
        
        add(mainPanel);
    }
    
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception e) {
                e.printStackTrace();
            }
            
            new PTZControlTest().setVisible(true);
        });
    }
}
