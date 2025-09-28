import React from 'react';
import ReactDOM from 'react-dom/client';
import FormBuilderAdmin from './features/form-builder/FormBuilderAdmin.js';

// index.html에 있는 'root' div를 선택합니다.
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

// 'root' div 안에 우리 앱(FormBuilderAdmin 컴포넌트)을 그려줍니다.
root.render(
  <React.StrictMode>
    <FormBuilderAdmin />
  </React.StrictMode>
);