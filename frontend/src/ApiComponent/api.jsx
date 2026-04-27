
import { useEffect } from "react";
import AxiosInstance from "../Axios"; // Đảm bảo bạn đã cấu hình AxiosInstance riêng

// GET
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

// PUT (thường dùng để cập nhật)
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
