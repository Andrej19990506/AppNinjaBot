import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import './Header.css';

const Header = () => {
    const navigate = useNavigate();

    return (
        <header className="header">
            <IconButton 
                onClick={() => navigate(-1)}
                className="header-back-button"
            >
                <ArrowBackIcon />
            </IconButton>
        </header>
    );
};

export default Header; 