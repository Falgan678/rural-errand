// 地图功能模块
import { locationData } from './orderData.js';

// 显示地图弹窗
export function showMapModal() {
    const modal = document.getElementById('mapModal');
    if (modal) {
        modal.classList.remove('hidden');
        // 延迟初始化地图，确保容器已显示
        setTimeout(() => {
            initSimpleMap();
        }, 100);
    }
}

// 关闭地图弹窗
export function closeMapModal() {
    const modal = document.getElementById('mapModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 初始化简化地图（使用列表展示）
function initSimpleMap() {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    // 创建地图说明
    const mapHTML = `
        <div style="padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; font-size: 18px;">📍 跑腿需求分布</h3>
                <p style="margin: 0; opacity: 0.9; font-size: 14px;">以下是当前区域内的所有待接订单位置</p>
            </div>
            
            <div style="display: grid; gap: 15px;">
                ${locationData.map((location, index) => `
                    <div style="background: white; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #10b981;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="background: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${index + 1}</span>
                                <h4 style="margin: 0; color: #1f2937; font-size: 16px;">${location.title}</h4>
                            </div>
                            <span style="color: #ef4444; font-weight: bold; font-size: 18px;">¥${location.fee}</span>
                        </div>
                        <div style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                            <div style="margin-bottom: 5px;">📍 ${location.address}</div>
                            <div style="color: #9ca3af; font-size: 12px;">坐标: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 8px; border: 1px solid #10b981;">
                <p style="margin: 0; color: #059669; font-size: 13px; line-height: 1.6;">
                    💡 提示：点击"接单"按钮可以接取订单，系统会根据您的位置推荐最近的订单。
                </p>
            </div>
        </div>
    `;

    mapContainer.innerHTML = mapHTML;
}

// 初始化地图（保留接口兼容性）
export function initMap() {
    initSimpleMap();
}