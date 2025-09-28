import React, { useState } from 'react'; // useState를 import 합니다.
import './FormBuilderAdmin.css';

const FormBuilderAdmin = () => {
  // 1. 선택된 배경 이미지를 저장할 state를 생성합니다. 초기값은 null 입니다.
  const [backgroundImage, setBackgroundImage] = useState(null);

  // 2. 파일이 선택되었을 때 실행될 함수입니다.
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // FileReader는 브라우저가 파일을 읽을 수 있게 도와주는 친구입니다.
      const reader = new FileReader();
      reader.onloadend = () => {
        // 파일 읽기가 끝나면, 결과를 backgroundImage state에 저장합니다.
        setBackgroundImage(reader.result);
      };
      reader.readAsDataURL(file); // 파일을 Data URL 형태로 읽습니다.
    }
  };

  return (
    <div className="form-builder-admin">
      <header className="admin-header">
        <h1>관리자 양식 편집기 v1.1</h1>
        <p>이곳에서 신청서 양식을 관리하고 입력 필드를 배치하세요.</p>
      </header>
      
      <main className="admin-workspace">
        <div className="form-canvas">
          {/* 3. backgroundImage state 값에 따라 동적으로 내용을 보여줍니다. */}
          {backgroundImage ? (
            <img src={backgroundImage} alt="신청서 배경" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <p>아래 '배경 이미지 선택' 버튼을 눌러주세요.</p>
          )}
        </div>
        
        <aside className="admin-tools">
          <h2>도구상자</h2>
          {/* 4. 파일을 선택할 수 있는 input 요소를 추가합니다. */}
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            style={{ display: 'none' }} // 기본 input은 숨깁니다.
            id="imageUploadInput"
          />
          {/* 사용자가 누를 보기 좋은 버튼을 만들고, 숨겨진 input을 클릭하게 합니다. */}
          <label htmlFor="imageUploadInput" className="image-upload-label">
            배경 이미지 선택
          </label>
          <hr />
          <button>텍스트 필드 추가</button>
          <button>체크박스 추가</button>
        </aside>
      </main>
    </div>
  );
};

// CSS와 상호작용할 수 있도록 label에 className을 추가하고, 간단한 스타일을 줍시다.
// FormBuilderAdmin.css 파일 맨 아래에 아래 스타일을 추가해주세요.
/*
.image-upload-label {
  display: block;
  width: calc(100% - 1.6rem); // padding 고려
  padding: 0.8rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  text-align: center;
  border-radius: 4px;
}

.image-upload-label:hover {
  background-color: #0056b3;
}
*/
export default FormBuilderAdmin;