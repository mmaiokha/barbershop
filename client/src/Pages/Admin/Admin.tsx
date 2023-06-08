import AdminNav from "../../Components/AdminComponents/AdminNav/AdminNav";
import {Grid} from "@mui/material";
import {Outlet} from "react-router-dom";

function Admin() {
    return (
        <Grid container className='container'>
            <AdminNav/>
            <Outlet/>
        </Grid>
    )
}

export default Admin