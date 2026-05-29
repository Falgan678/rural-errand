// 订单数据模块
export const orderData = {
    // 示例订单数据
    orders: [
        {
            id: 1,
            title: '买药',
            pickupAddress: '东村村委会',
            deliveryAddress: '镇上药店',
            distance: 5.2,
            time: '今天下午3点前',
            createTime: new Date().toISOString(), // 默认为当前时间
            fee: 15,
            status: 'pending',
            isUrgent: true,
            remark: '需要购买感冒药和退烧药，请帮忙买好后送到家里，谢谢！',
            type: 'customer'
        },
        {
            id: 2,
            title: '送文件',
            pickupAddress: '西村小卖部',
            deliveryAddress: '南村王家',
            distance: 3.8,
            time: '今天傍晚6点前',
            createTime: new Date(Date.now() - 86400000).toISOString(), // 1天前
            fee: 10,
            status: 'pending',
            isUrgent: false,
            remark: '文件比较重要，请小心保管',
            type: 'customer'
        },
        {
            id: 3,
            title: '代购生活用品',
            pickupAddress: '镇上超市',
            deliveryAddress: '北村村口',
            distance: 7.5,
            time: '明天上午',
            createTime: new Date(Date.now() - 172800000).toISOString(), // 2天前
            fee: 20,
            status: 'pending',
            isUrgent: false,
            remark: '需要购买米、油、盐等生活用品，清单已发微信',
            type: 'customer'
        },
        {
            id: 4,
            title: '取快递',
            pickupAddress: '家里',
            deliveryAddress: '镇上超市',
            distance: 6.5,
            time: '明天上午',
            createTime: new Date(Date.now() - 345600000).toISOString(), // 4天前
            fee: 18,
            status: 'pending',
            isUrgent: false,
            remark: '快递比较大件，需要帮忙搬运',
            type: 'customer'
        },
        {
            id: 5,
            title: '送文件',
            pickupAddress: '村口小卖部',
            deliveryAddress: '家里',
            distance: 2.3,
            time: '今天傍晚',
            createTime: new Date(Date.now() - 604800000).toISOString(), // 7天前
            fee: 10,
            status: 'completed',
            isUrgent: false,
            remark: '',
            type: 'customer'
        },
        {
            id: 6,
            title: '送药',
            pickupAddress: '西村卫生所',
            deliveryAddress: '东村王家',
            distance: 4.2,
            time: '今天下午4点前',
            createTime: new Date(Date.now() - 1209600000).toISOString(), // 14天前
            fee: 12,
            status: 'ongoing',
            isUrgent: false,
            remark: '药品需要冷藏保存',
            type: 'runner'
        },
        {
            id: 7,
            title: '取包裹',
            pickupAddress: '镇上邮局',
            deliveryAddress: '南村村委会',
            distance: 8.5,
            time: '明天上午',
            createTime: new Date(Date.now() - 2592000000).toISOString(), // 30天前
            fee: 22,
            status: 'completed',
            isUrgent: false,
            remark: '',
            type: 'runner'
        }
    ],

    // 获取所有订单
    getAllOrders() {
        return this.orders;
    },

    // 根据类型获取订单
    getOrdersByType(type) {
        return this.orders.filter(order => order.type === type);
    },

    // 根据状态获取订单
    getOrdersByStatus(status, type = null) {
        let filtered = this.orders;
        if (type) {
            filtered = filtered.filter(order => order.type === type);
        }
        if (status === 'all') {
            return filtered;
        }
        return filtered.filter(order => order.status === status);
    },

    // 综合筛选订单
    filterOrders(criteria) {
        let filtered = this.orders;

        // 1. 角色筛选
        if (criteria.type) {
            filtered = filtered.filter(order => order.type === criteria.type);
        }

        // 2. 状态筛选
        if (criteria.status && criteria.status !== 'all') {
            filtered = filtered.filter(order => order.status === criteria.status);
        }

        // 3. 关键词搜索 (订单号、标题、地址、备注、费用、距离)
        if (criteria.keyword) {
            const keyword = criteria.keyword.toLowerCase();
            filtered = filtered.filter(order => {
                return (
                    order.id.toString().includes(keyword) ||
                    order.title.toLowerCase().includes(keyword) ||
                    order.pickupAddress.toLowerCase().includes(keyword) ||
                    order.deliveryAddress.toLowerCase().includes(keyword) ||
                    (order.remark && order.remark.toLowerCase().includes(keyword)) ||
                    order.fee.toString().includes(keyword) ||
                    order.distance.toString().includes(keyword) ||
                    order.time.toLowerCase().includes(keyword)
                );
            });
        }

        // 4. 时间筛选
        if (criteria.timeRange) {
            const now = new Date();
            const { type, start, end } = criteria.timeRange;
            
            if (type === 'custom' && start && end) {
                // 自定义时间范围
                const startTime = new Date(start).getTime();
                const endTime = new Date(end).getTime() + 86400000; // 包含结束当天
                filtered = filtered.filter(order => {
                    const orderTime = new Date(order.createTime).getTime();
                    return orderTime >= startTime && orderTime < endTime;
                });
            } else if (type !== 'all' && type !== 'custom') {
                // 预设时间范围 (天数)
                const days = parseInt(type);
                const cutoffTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).getTime();
                filtered = filtered.filter(order => {
                    const orderTime = new Date(order.createTime).getTime();
                    return orderTime >= cutoffTime;
                });
            }
        }

        return filtered;
    },

    // 添加订单
    addOrder(order) {
        const newOrder = {
            id: this.orders.length + 1,
            ...order,
            createTime: new Date().toISOString(),
            status: 'pending'
        };
        this.orders.unshift(newOrder);
        return newOrder;
    },

    // 更新订单状态
    updateOrderStatus(id, status) {
        const order = this.orders.find(o => o.id === id);
        if (order) {
            order.status = status;
        }
    },

    // 获取统计数据
    getStats() {
        const today = new Date().toDateString();
        return {
            todayOrders: 28,
            pendingOrders: this.orders.filter(o => o.status === 'pending').length,
            totalServices: 156
        };
    }
};

// 地图位置数据
export const locationData = [
    { lat: 23.1291, lng: 113.2644, title: '买药', address: '东村村委会 → 镇上药店', fee: 15 },
    { lat: 23.1301, lng: 113.2654, title: '送文件', address: '西村小卖部 → 南村王家', fee: 10 },
    { lat: 23.1281, lng: 113.2634, title: '代购生活用品', address: '镇上超市 → 北村村口', fee: 20 },
    { lat: 23.1311, lng: 113.2664, title: '取快递', address: '家里 → 镇上超市', fee: 18 },
    { lat: 23.1271, lng: 113.2624, title: '送药', address: '西村卫生所 → 东村王家', fee: 12 }
];