import axios from 'axios'
import { API_BASE } from './config';
const myURL = `${API_BASE}/`;
const AxiosInstance = axios.create({
    baseURL: myURL, // Địa chỉ gốc — mọi request tự động thêm vào đầu
    timeout: 15000, // Tăng từ 5000 lên 15000ms — tránh timeout với query nặng như get-site-summary
    headers: {
        'Content-Type': 'application/json', // Nói với backend "gửi và nhận dạng JSON"
        accept: 'application/json', 
    },
});
// Interceptor 1 — Tự động gắn token vào Request trước khi gửi đi
AxiosInstance.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("token");
    if (token) {
        config.headers["Authorization"] = `Token ${token}`;
    }
    return config; //  Trả lại config đã được thêm token
});
// Interceptor 2 — Tự động xử lý khi token hết hạn hoặc không hợp lệ
AxiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            sessionStorage.removeItem("token");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);
export default AxiosInstance