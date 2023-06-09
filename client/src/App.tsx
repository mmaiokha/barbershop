import React, {useEffect} from 'react';
import {Routes, Route, BrowserRouter} from 'react-router-dom'

import Auth from "pages/Auth";
import Admin from "pages/Admin";

import LoginForm from "features/auth/components/LoginForm";
import RegisterForm from "features/auth/components/RegisterForm";
import AuthComponent from "features/auth/hoc/AuthComponent";

import AdminVisits from "features/admin/pages/AdminVisits";
import AdminEmployee from "features/admin/pages/AdminEmployee";
import AdminServices from "features/admin/pages/AdminServices";
import AdminBranch from "features/admin/pages/AdminBranch";

import {useAppDispatch} from "hooks/store";
import {refreshTokensThunk} from "store/slices/auth";
import AdminEmployeeForm from "./features/admin/pages/AdminEmployeeForm";


function App() {
    const dispatch = useAppDispatch()
    useEffect(() => {
        const token = localStorage.getItem('refreshToken')
        if (token) {
            dispatch(refreshTokensThunk())
        }

        const tokenRefreshInterval = setInterval(() => {
            if (token) {
                dispatch(refreshTokensThunk())
            }
        }, 1000 * 60 * 12);

        return () => {
            clearInterval(tokenRefreshInterval);
        };

    }, [dispatch])

    return (
        <div className="App">
            <BrowserRouter>
                <Routes>
                    <Route path='a' element={<Auth/>}>
                        <Route path='login' element={<LoginForm/>}/>
                        <Route path='register' element={<RegisterForm/>}/>
                    </Route>
                    <Route path='admin' element={<AuthComponent children={<Admin/>}/>}>
                        <Route path='visits'>
                            <Route path='' element={<AdminVisits/>}/>
                        </Route>

                        <Route path='employee'>
                            <Route path='' element={<AdminEmployee/>}/>
                            <Route path='create' element={<AdminEmployeeForm/>}/>
                        </Route>

                        <Route path='services'>
                            <Route path='' element={<AdminServices/>}/>
                        </Route>

                        <Route path='branch'>
                            <Route path='' element={<AdminBranch/>}/>
                        </Route>
                    </Route>


                    <Route path='' element={<div>Main page</div>}/>
                </Routes>
            </BrowserRouter>
        </div>
    );
}

export default App;
