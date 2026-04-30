import AxiosInstance from "../Axios";

// GET
// export: cho phép file khác import hàm này vào dùng
// const getData — đặt tên hàm là getData
// File khác muốn dùng thì import vào: import { getData } from "../api";

// async — hàm này có thể chờ đợi (vì gọi API mất thời gian)
// path — đường dẫn API truyền vào, ví dụ: "/solardb/get-latest-meter-records/"
// config = {} — tham số tùy chọn thêm, mặc định là rỗng nếu không truyền vào

// AxiosInstance — dùng cấu hình đã setup trong Axios.js (có sẵn token, baseURL...)
// .get(path, config) — gửi request GET đến path
// await — chờ backend trả về xong mới chạy tiếp
// res — chứa toàn bộ phản hồi từ backend
export const getData = async (path, config = {}) => {
    try {
        const res = await AxiosInstance.get(path, config);
        return res.data;
    } catch (err) {
        console.error("GET error:", err);
        return null;
    }
};

// POST
export const postData = async (path, data, config = {}) => {
    try {
        const res = await AxiosInstance.post(path, data, config);
        return res.data;
    } catch (err) {
        console.error("POST error:", err);
        return null;
    }
};

// PUT
export const putData = async (path, data, config = {}) => {
    try {
        const res = await AxiosInstance.put(path, data, config);
        return res.data;
    } catch (err) {
        console.error("PUT error:", err);
        return null;
    }
};

// DELETE
export const deleteData = async (path, config = {}) => {
    try {
        const res = await AxiosInstance.delete(path, config);
        return res.data;
    } catch (err) {
        console.error("DELETE error:", err);
        return null;
    }
};