/**
 * Ví dụ: SKKNGeneratorWithValidation.tsx
 * Component React tích hợp Curriculum Validator
 */

import React, { useState, useRef } from 'react';
import { curriculumValidator } from '@/utils/curriculum-validator';

interface ValidationResult {
  isValid: boolean;
  grade: string;
  subject: string;
  issues: string[];
  suggestions: string[];
}

export function SKKNGeneratorWithValidation() {
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState('9');
  const [outline, setOutline] = useState('');
  
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [skknOutput, setSKKNOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Step 1: Validate dàn ý trước khi tạo SKKN
   */
  const handleValidate = () => {
    if (!subject || !grade || !outline.trim()) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    const result = curriculumValidator.validateOutline(subject, grade, outline);
    setValidation(result);
    setError('');

    if (!result.isValid) {
      setSKKNOutput(''); // Clear output nếu invalid
    }
  };

  /**
   * Step 2: Tạo SKKN (chỉ khi validation pass)
   */
  const handleGenerateSKKN = async () => {
    // Re-validate before generating
    const result = curriculumValidator.validateOutline(subject, grade, outline);

    if (!result.isValid) {
      setError('Dàn ý chưa hợp lệ. Vui lòng sửa lỗi trước.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Generate system prompt chuẩn theo GDPT 2018
      const systemPrompt = curriculumValidator.generateSystemPrompt(subject, grade);

      // Call Gemini API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // API key sẽ được handle từ backend (không để frontend)
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          system: systemPrompt, // <-- System prompt chuẩn GDPT 2018!
          messages: [
            {
              role: 'user',
              content: `Tạo dàn ý chi tiết cho SKKN (Sáng kiến kinh nghiệm) theo yêu cầu:
              
Môn học: ${subject}
Lớp: ${grade}
Đề tài: ${outline}

Hãy tạo dàn ý gồm:
1. Lý do chọn đề tài
2. Mục tiêu SKKN
3. Nội dung chính (3-5 mục)
4. Phương pháp thực hiện
5. Dự kiến kết quả`,
            },
          ],
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.content || !data.content[0]) {
        throw new Error('Invalid response from API');
      }

      const generatedOutline = data.content[0].text;

      // Post-validate output (kiểm tra Gemini có sinh content vượt cấp không)
      const outputValidation = curriculumValidator.validateOutline(
        subject,
        grade,
        generatedOutline
      );

      if (!outputValidation.isValid) {
        console.warn(
          'Cảnh báo: Output từ Gemini vẫn chứa nội dung vượt cấp',
          outputValidation.issues
        );
        setError(
          'Cảnh báo: Dàn ý sinh ra có nội dung vượt cấp. Vui lòng kiểm tra lại.'
        );
        // Vẫn hiển thị output để user xem
      }

      setSKKNOutput(generatedOutline);
    } catch (err) {
      setError(`Lỗi: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy output to clipboard
   */
  const handleCopyOutput = () => {
    navigator.clipboard.writeText(skknOutput);
    alert('Đã copy vào clipboard');
  };

  /**
   * Get suggested topics
   */
  const suggestedTopics = curriculumValidator.getSuggestedTopics(subject, grade);
  const gradeInfo = curriculumValidator.getGradeInfo(grade);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <h1>Tạo SKKN với Kiểm tra GDPT 2018</h1>

      {/* Input Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Môn học
            </label>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setValidation(null);
                setSKKNOutput('');
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
            >
              <option value="Toán">Toán</option>
              <option value="Ngữ văn">Ngữ văn</option>
              <option value="Tiếng Anh">Tiếng Anh</option>
              <option value="Địa lí">Địa lí</option>
              <option value="Lịch sử">Lịch sử</option>
              <option value="Khoa học tự nhiên">Khoa học tự nhiên</option>
              <option value="Giáo dục công dân">Giáo dục công dân</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Lớp ({gradeInfo.stage})
            </label>
            <select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setValidation(null);
                setSKKNOutput('');
              }}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
            >
              <optgroup label="THCS">
                <option value="6">Lớp 6</option>
                <option value="7">Lớp 7</option>
                <option value="8">Lớp 8</option>
                <option value="9">Lớp 9</option>
              </optgroup>
              <optgroup label="THPT">
                <option value="10">Lớp 10</option>
                <option value="11">Lớp 11</option>
                <option value="12">Lớp 12</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Dàn ý / Đề tài SKKN
          </label>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder="Ví dụ: Rèn luyện kỹ năng giải phương trình bậc hai cho học sinh lớp 9"
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontFamily: 'monospace',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Suggested Topics */}
        {suggestedTopics.length > 0 && (
          <div
            style={{
              padding: '1rem',
              background: '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 500 }}>
              Đề tài phù hợp cho {subject} lớp {grade}:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
              {suggestedTopics.map((topic, i) => (
                <li key={i}>{topic}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '12px',
              background: '#fcebeb',
              border: '1px solid #f09595',
              borderRadius: '4px',
              color: '#a32d2d',
              marginBottom: '1rem',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleValidate}
            style={{
              padding: '10px 16px',
              background: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Kiểm tra
          </button>

          <button
            onClick={handleGenerateSKKN}
            disabled={loading || !validation?.isValid}
            style={{
              padding: '10px 16px',
              background: validation?.isValid ? '#185fa5' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: validation?.isValid ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            {loading ? 'Đang tạo...' : 'Tạo SKKN'}
          </button>
        </div>
      </div>

      {/* Validation Result */}
      {validation && (
        <div
          style={{
            padding: '1rem',
            background: validation.isValid ? '#eaf3de' : '#fcebeb',
            border: `1px solid ${validation.isValid ? '#97c459' : '#f09595'}`,
            borderRadius: '4px',
            marginBottom: '2rem',
          }}
        >
          <p
            style={{
              margin: 0,
              color: validation.isValid ? '#3b6d11' : '#a32d2d',
              fontWeight: 500,
            }}
          >
            {validation.isValid ? '✓ OK' : '⚠ Lỗi'} -{' '}
            {validation.isValid
              ? `Nội dung phù hợp với ${subject} lớp ${grade}`
              : 'Dàn ý chứa nội dung vượt cấp'}
          </p>

          {!validation.isValid && (
            <>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                <strong>Lỗi:</strong> {validation.issues.join(', ')}
              </p>
              {validation.suggestions.length > 0 && (
                <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                  <strong>Gợi ý:</strong> {validation.suggestions.join('. ')}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Output Section */}
      {skknOutput && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Dàn ý SKKN</h2>
            <button
              onClick={handleCopyOutput}
              style={{
                padding: '8px 12px',
                background: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Copy
            </button>
          </div>

          <div
            style={{
              padding: '1.5rem',
              background: '#fafafa',
              border: '1px solid #ddd',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '13px',
              maxHeight: '500px',
              overflow: 'auto',
              lineHeight: 1.6,
            }}
          >
            {skknOutput}
          </div>
        </div>
      )}
    </div>
  );
}

export default SKKNGeneratorWithValidation;
