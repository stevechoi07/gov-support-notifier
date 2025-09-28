import React from 'react';
import './FormBuilderAdmin.css'; // 기본 스타일을 위한 CSS 파일도 곧 만들 거예요!

const FormBuilderAdmin = () => {
  return (
    <div className="form-builder-admin">
      <header className="admin-header">
        <h1>관리자 양식 편집기 v1.0</h1>
        <p>이곳에서 신청서 양식을 관리하고 입력 필드를 배치하세요.</p>
      </header>
      
      <main className="admin-workspace">
        <div className="form-canvas">
          {/* 이 구역이 바로 신청서 배경 이미지가 보이고, 
              필드를 올려놓는 '캔버스'가 될 예정입니다! */}
          <p>신청서 이미지를 불러와주세요.</p>
        </div>
        
        <aside className="admin-tools">
          <h2>도구상자</h2>
          {/* 이곳에는 텍스트 필드, 체크박스 등을 추가하는 버튼들이 들어올 거예요. */}
          <button>텍스트 필드 추가</button>
          <button>체크박스 추가</button>
        </aside>
      </main>
    </div>
  );
};

export default FormBuilderAdmin;