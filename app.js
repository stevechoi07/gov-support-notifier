// App.js

// React 라이브러리를 불러옵니다.
const { useState } = React;

// 우리가 만든 FormBuilderAdmin 컴포넌트를 불러옵니다.
// 중요: 확장자(.js)까지 모두 적어주세요!
import FormBuilderAdmin from './features/form-builder/FormBuilderAdmin.js';

// index.html에 있는 'root' div를 선택합니다.
const root = ReactDOM.createRoot(document.getElementById('root'));

// 'root' div 안에 우리 앱(FormBuilderAdmin 컴포넌트)을 그려줍니다.
root.render(<FormBuilderAdmin />);