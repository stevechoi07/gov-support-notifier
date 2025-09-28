import React from 'react';
import ReactDOM from 'react-dom/client';
import FormBuilderAdmin from './features/form-builder/FormBuilderAdmin.js';

// HTML에서 root ID를 가진 요소를 찾습니다.
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

// 메인 컴포넌트를 화면에 렌더링(그려주기)합니다.
root.render(
  <React.StrictMode>
    <FormBuilderAdmin />
  </React.StrictMode>
);