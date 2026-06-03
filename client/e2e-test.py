#!/usr/bin/env python3
"""
AITexasPokerGame E2E 测试套件
覆盖：代码静态分析、交互逻辑检查、视觉一致性验证
"""

import re
import os
import sys
from pathlib import Path
from collections import defaultdict

# ============================================================
# 测试配置
# ============================================================
CLIENT_DIR = Path(__file__).parent / "src"

# 设计系统变量定义
EXPECTED_CSS_VARS = {
    "--bg-primary": "#0a3d28",
    "--bg-secondary": "#0d4a32",
    "--bg-card": "rgba(8, 50, 30, 0.92)",
    "--bg-glass": "rgba(10, 45, 30, 0.8)",
    "--bg-hover": "rgba(255, 255, 255, 0.08)",
    "--accent-gold": "#d4af37",
    "--accent-gold-light": "#e8c547",
    "--accent-gold-dim": "rgba(212, 175, 55, 0.15)",
    "--accent-gold-border": "rgba(212, 175, 55, 0.25)",
    "--accent-red": "#e74c3c",
    "--accent-red-bg": "rgba(231, 76, 60, 0.15)",
    "--accent-green": "#27ae60",
    "--accent-green-bg": "rgba(39, 174, 96, 0.15)",
    "--accent-blue": "#3498db",
    "--accent-orange": "#f39c12",
    "--text-primary": "#e8e8e8",
    "--text-secondary": "#8b9aaa",
    "--text-muted": "rgba(255, 255, 255, 0.35)",
    "--text-gold": "#d4af37",
    "--border-subtle": "rgba(212, 175, 55, 0.12)",
    "--border-medium": "rgba(212, 175, 55, 0.2)",
    "--border-strong": "rgba(212, 175, 55, 0.35)",
    "--shadow-sm": "0 2px 8px rgba(0, 0, 0, 0.25)",
    "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.35)",
    "--shadow-lg": "0 16px 48px rgba(0, 0, 0, 0.45)",
    "--shadow-gold": "0 4px 20px rgba(212, 175, 55, 0.15)",
    "--shadow-gold-lg": "0 8px 32px rgba(212, 175, 55, 0.25)",
    "--radius-sm": "6px",
    "--radius-md": "10px",
    "--radius-lg": "16px",
    "--radius-xl": "24px",
    "--radius-full": "9999px",
    "--font-sans": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    "--transition-fast": "150ms ease",
    "--transition-normal": "250ms ease",
    "--transition-slow": "400ms ease",
}

# 禁止使用的旧颜色（与绿色主题不协调）
FORBIDDEN_COLORS = [
    "#0d1b2a",   # 旧深蓝
    "#1b2838",   # 旧深蓝灰
    "#1a1a2e",   # 旧AI config背景
    "#16213e",   # 旧登录背景
    "#00bf86",   # 旧亮绿
    "#006a55",   # 旧深绿
    "#33cccc",   # 旧青色返回按钮
    "#6916a0",   # 旧紫色loader
]

# ============================================================
# 测试框架
# ============================================================

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def ok(self, test_name, detail=""):
        self.passed.append((test_name, detail))
    
    def fail(self, test_name, detail):
        self.failed.append((test_name, detail))
    
    def warn(self, test_name, detail):
        self.warnings.append((test_name, detail))
    
    def summary(self):
        total = len(self.passed) + len(self.failed) + len(self.warnings)
        print(f"\n{'='*60}")
        print(f"E2E 测试结果汇总")
        print(f"{'='*60}")
        print(f"通过: {len(self.passed)} | 失败: {len(self.failed)} | 警告: {len(self.warnings)} | 总计: {total}")
        if self.failed:
            print(f"\n失败项:")
            for name, detail in self.failed:
                print(f"  [FAIL] {name}: {detail}")
        if self.warnings:
            print(f"\n警告项:")
            for name, detail in self.warnings:
                print(f"  [WARN] {name}: {detail}")
        return len(self.failed) == 0

results = TestResult()

# ============================================================
# 1. CSS 设计系统测试
# ============================================================

print("\n" + "="*60)
print("测试组 1: CSS 设计系统")
print("="*60)

global_css = (CLIENT_DIR / "assets" / "global.css").read_text()

# 1.1 检查所有 CSS 变量是否正确定义
for var_name, expected_value in EXPECTED_CSS_VARS.items():
    pattern = f"{re.escape(var_name)}:\\s*{re.escape(expected_value)}"
    if re.search(pattern, global_css):
        results.ok(f"CSS变量 {var_name}", f"值 = {expected_value}")
    else:
        # 检查变量是否存在但值不同
        if var_name in global_css:
            actual = re.search(f"{re.escape(var_name)}:\\s*([^;]+)", global_css)
            actual_val = actual.group(1).strip() if actual else "NOT FOUND"
            results.fail(f"CSS变量 {var_name}", f"期望值 {expected_value}, 实际值 {actual_val}")
        else:
            results.fail(f"CSS变量 {var_name}", "变量未定义")

# 1.2 检查 Vue 过渡动画是否保留
if ".fade-enter-active" in global_css and ".fade-leave-active" in global_css:
    results.ok("Vue fade 过渡动画", "已保留")
else:
    results.fail("Vue fade 过渡动画", "丢失")

# 1.3 检查现代滚动条样式
if "::-webkit-scrollbar" in global_css:
    results.ok("WebKit 滚动条样式", "已定义")
else:
    results.warn("WebKit 滚动条样式", "未定义")

# 1.4 检查禁止使用的旧颜色
forbidden_found = []
for color in FORBIDDEN_COLORS:
    if color in global_css:
        forbidden_found.append(color)
if forbidden_found:
    results.fail("global.css 旧颜色残留", f"发现: {', '.join(forbidden_found)}")
else:
    results.ok("global.css 旧颜色检查", "无残留")

# ============================================================
# 2. Vue 组件代码质量测试
# ============================================================

print("\n" + "="*60)
print("测试组 2: Vue 组件代码质量")
print("="*60)

vue_files = list(CLIENT_DIR.rglob("*.vue"))

# 2.1 检查每个 .vue 文件结构
for vue_file in vue_files:
    content = vue_file.read_text()
    rel_path = vue_file.relative_to(CLIENT_DIR)
    
    # 检查 template 标签
    if "<template>" not in content or "</template>" not in content:
        results.fail(f"{rel_path} 结构", "缺少 template 标签")
        continue
    
    # 检查 script 标签
    if "<script" not in content or "</script>" not in content:
        results.fail(f"{rel_path} 结构", "缺少 script 标签")
        continue
    
    # 检查 template 中未闭合标签（简单检查）
    template_match = re.search(r'<template>(.*?)</template>', content, re.DOTALL)
    if template_match:
        template_content = template_match.group(1)
        # 检查常见未闭合标签
        unclosed = re.findall(r'<(div|span|i|b|p)\s[^/][^>]*>', template_content)
        closed = re.findall(r'</(div|span|i|b|p)>', template_content)
        # 对于自闭合标签忽略
        if len(unclosed) > len(closed) + 5:  # 容差5个
            results.warn(f"{rel_path} 标签平衡", f"未闭合标签可能过多: {len(unclosed)} 开 vs {len(closed)} 闭")

# 2.2 检查 game.vue 的关键交互
if (CLIENT_DIR / "views" / "game.vue").exists():
    game_content = (CLIENT_DIR / "views" / "game.vue").read_text()
    
    # 检查 socket 初始化
    if "socketInit" in game_content and "socket.on('connect'" in game_content:
        results.ok("game.vue Socket 连接", "事件监听已配置")
    else:
        results.fail("game.vue Socket 连接", "缺少连接事件监听")
    
    # 检查倒计时逻辑
    if "doCountDown" in game_content and "clearTimeout" in game_content:
        results.ok("game.vue 倒计时逻辑", "已实现")
    else:
        results.warn("game.vue 倒计时逻辑", "可能不完整")
    
    # 检查背景是否为绿色毡布
    if "#0d5236" in game_content and "#0a3d28" in game_content:
        results.ok("game.vue 绿色毡布背景", "颜色正确")
    else:
        results.fail("game.vue 绿色毡布背景", "颜色不正确")
    
    # 检查设置菜单
    if "showSetting" in game_content and "toggleSetting" in game_content:
        results.ok("game.vue 设置菜单", "交互逻辑存在")
    else:
        results.fail("game.vue 设置菜单", "交互逻辑缺失")

# 2.3 检查 Action.vue 按钮交互
if (CLIENT_DIR / "components" / "Action.vue").exists():
    action_content = (CLIENT_DIR / "components" / "Action.vue").read_text()
    
    required_actions = ['fold', 'check', 'call', 'raise', 'allin']
    found_actions = [a for a in required_actions if f"'{a}'" in action_content]
    if len(found_actions) == len(required_actions):
        results.ok("Action.vue 操作按钮", f"全部5个: {', '.join(found_actions)}")
    else:
        missing = set(required_actions) - set(found_actions)
        results.fail("Action.vue 操作按钮", f"缺少: {', '.join(missing)}")
    
    # 检查防重复点击
    if "actioned" in action_content:
        results.ok("Action.vue 防重复点击", "已实现")
    else:
        results.warn("Action.vue 防重复点击", "未实现")

# 2.4 检查 login.vue
if (CLIENT_DIR / "views" / "login.vue").exists():
    login_content = (CLIENT_DIR / "views" / "login.vue").read_text()
    if "login" in login_content and "userAccount" in login_content and "password" in login_content:
        results.ok("login.vue 表单字段", "已定义")
    else:
        results.fail("login.vue 表单字段", "缺失")

# ============================================================
# 3. 视觉一致性测试
# ============================================================

print("\n" + "="*60)
print("测试组 3: 视觉一致性")
print("="*60)

all_vue_contents = {}
for vue_file in vue_files:
    all_vue_contents[vue_file.name] = vue_file.read_text()

# 3.1 检查禁止使用颜色的全局扫描
forbidden_locations = defaultdict(list)
for color in FORBIDDEN_COLORS:
    for filename, content in all_vue_contents.items():
        if color in content:
            forbidden_locations[color].append(filename)

if forbidden_locations:
    for color, files in forbidden_locations.items():
        results.warn(f"旧颜色残留 {color}", f"出现在: {', '.join(files)}")
else:
    results.ok("全局旧颜色检查", "所有组件无旧颜色残留")

# 3.2 检查 CSS 变量是否被正确使用
style_files = list(CLIENT_DIR.rglob("*.vue")) + list(CLIENT_DIR.rglob("*.css")) + list(CLIENT_DIR.rglob("*.less"))
css_var_usage = defaultdict(int)
for sf in style_files:
    content = sf.read_text()
    vars_found = re.findall(r'var\((--[\w-]+)\)', content)
    for v in vars_found:
        css_var_usage[v] += 1

# 检查常用变量是否被使用
key_vars = ["--bg-glass", "--accent-gold", "--border-medium", "--radius-sm", "--shadow-sm"]
for v in key_vars:
    if css_var_usage[v] > 0:
        results.ok(f"CSS变量使用 {v}", f"被使用 {css_var_usage[v]} 次")
    else:
        results.warn(f"CSS变量使用 {v}", "未被使用")

# 3.3 检查背景渐变质量
for filename, content in all_vue_contents.items():
    if "radial-gradient" in content or "linear-gradient" in content:
        gradients = re.findall(r'(?:radial|linear)-gradient\([^)]+\)', content)
        for grad in gradients:
            # 检查是否有丑陋的硬编码颜色
            ugly_colors = ["#00bf86", "#006a55", "#00976e", "#33cccc"]
            for uc in ugly_colors:
                if uc in grad:
                    results.warn(f"{filename} 渐变颜色", f"发现不协调颜色 {uc} in gradient")

# ============================================================
# 4. 交互逻辑测试
# ============================================================

print("\n" + "="*60)
print("测试组 4: 交互逻辑")
print("="*60)

# 4.1 检查 BuyIn 弹窗关闭逻辑
if (CLIENT_DIR / "components" / "BuyIn.vue").exists():
    buyin_content = (CLIENT_DIR / "components" / "BuyIn.vue").read_text()
    if "closeBuyIn" in buyin_content and "@click" in buyin_content:
        results.ok("BuyIn.vue 关闭交互", "已实现")
    else:
        results.fail("BuyIn.vue 关闭交互", "缺失")
    
    # 检查 emoji 是否已移除
    if "💴" in buyin_content or "🎴" in buyin_content:
        results.fail("BuyIn.vue emoji", "emoji 未移除")
    else:
        results.ok("BuyIn.vue emoji", "已移除")

# 4.2 检查 Toast 超时逻辑
if (CLIENT_DIR / "components" / "Toast.vue").exists():
    toast_content = (CLIENT_DIR / "components" / "Toast.vue").read_text()
    if "setTimeout" in toast_content and "timeOut" in toast_content:
        results.ok("Toast.vue 超时逻辑", "已实现")
    else:
        results.warn("Toast.vue 超时逻辑", "可能不完整")

# 4.3 检查 AIAdvisor 抽屉交互
if (CLIENT_DIR / "components" / "AIAdvisor.vue").exists():
    ai_content = (CLIENT_DIR / "components" / "AIAdvisor.vue").read_text()
    if "isExpanded" in ai_content and "openDrawer" in ai_content and "closeDrawer" in ai_content:
        results.ok("AIAdvisor.vue 抽屉交互", "已完整实现")
    else:
        results.fail("AIAdvisor.vue 抽屉交互", "缺失")
    
    # 检查 overlay 点击关闭
    if "@click=\"closeDrawer\"" in ai_content:
        results.ok("AIAdvisor.vue Overlay关闭", "已实现")
    else:
        results.warn("AIAdvisor.vue Overlay关闭", "未实现")

# 4.4 检查 CardList 动画
if (CLIENT_DIR / "components" / "CardList.vue").exists():
    card_content = (CLIENT_DIR / "components" / "CardList.vue").read_text()
    if "@keyframes turnA" in card_content or "keyframes turn" in card_content:
        results.ok("CardList.vue 翻转动画", "已定义")
    else:
        results.warn("CardList.vue 翻转动画", "未定义")

# ============================================================
# 5. 响应式/可访问性测试
# ============================================================

print("\n" + "="*60)
print("测试组 5: 响应式与可访问性")
print("="*60)

# 5.1 检查媒体查询
media_query_files = []
for sf in style_files:
    content = sf.read_text()
    if "@media" in content:
        media_query_files.append(sf.name)

if media_query_files:
    results.ok("响应式媒体查询", f"在 {', '.join(set(media_query_files))} 中发现")
else:
    results.warn("响应式媒体查询", "未发现任何媒体查询")

# 5.2 检查 z-index 管理
z_index_values = []
for sf in style_files:
    content = sf.read_text()
    z_matches = re.findall(r'z-index:\s*(\d+)', content)
    z_index_values.extend([(sf.name, int(z)) for z in z_matches])

high_z = [(f, z) for f, z in z_index_values if z > 100]
if high_z:
    results.warn("z-index 管理", f"发现 {len(high_z)} 个高 z-index (>100): {high_z[:5]}")
else:
    results.ok("z-index 管理", "所有 z-index 在合理范围内")

# 5.3 检查 fixed 定位元素
fixed_elements = []
for sf in style_files:
    content = sf.read_text()
    if "position: fixed" in content:
        fixed_elements.append(sf.name)

if fixed_elements:
    results.ok("Fixed 定位元素", f"在 {', '.join(set(fixed_elements))} 中发现")
else:
    results.warn("Fixed 定位元素", "未发现")

# ============================================================
# 输出最终报告
# ============================================================

success = results.summary()

# 输出详细通过项
if results.passed:
    print(f"\n通过项详情 ({len(results.passed)}):")
    for name, detail in results.passed:
        print(f"  [OK] {name}: {detail}")

sys.exit(0 if success else 1)
