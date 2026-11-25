import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import * as userStore from './stores/userStore.js';

// 1. LocalStrategy — 이메일과 비밀번호로 로그인 검증
passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await userStore.findByEmail(email.trim());
        if (!user) {
          done(null, false, { message: '이메일 또는 비밀번호가 올바르지 않습니다' });
          return;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          done(null, false, { message: '이메일 또는 비밀번호가 올바르지 않습니다' });
          return;
        }
        // passwordHash를 제외한 공개 사용자 정보 전달
        done(null, { id: user.id, email: user.email, name: user.name });
      } catch (err) {
        done(err);
      }
    },
  ),
);

// 2. serializeUser — 로그인 성공 직후 세션에 사용자 id만 저장
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// 3. deserializeUser — 이후 요청마다 세션의 id로 사용자 조회 후 req.user에 복원
passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await userStore.findById(id);
    if (!user) {
      done(null, false);
      return;
    }
    done(null, { id: user.id, email: user.email, name: user.name });
  } catch (err) {
    done(err);
  }
});

export default passport;
