import axios from 'axios'

const myURL = 'http://192.168.1.13:8000/';

const AxiosInstance = axios.create({
    baseURL : myURL,
    timeout : 5000,
    headers : {
        'Content-Type' : 'application/json',
        accept: 'application/json',
    },
});

export default AxiosInstance