import axios from 'axios'

const myURL = 'http://localhost:8000/'; // Địa chỉ backend — lưu vào biến để dùng lại, không phải gõ lại nhiều lần.

const AxiosInstance = axios.create({
    baseURL: myURL, // Địa chỉ gốc — mọi request tự động thêm vào đầu
    timeout: 5000,
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