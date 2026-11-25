import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { config } from './config.js';
import passport from './passport.js';
import authRouter from './routes/authRouter.js';
import storageRouter from './routes/storageRouter.js';
import ingredientRouter from './routes/ingredientRouter.js';
import recipeRouter from './routes/recipeRouter.js';
import { notFound, errorHandler } from './middlewares/errorHandlers.js';

const app = express();

app.use(express.json());           // JSON 본문 해석
app.use(cookieParser());           // Cookie 헤더 해석
app.use(express.static('public')); // 프론트엔드 정적 파일 제공
app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60, // 1시간
    },
  }),
);
app.use(passport.initialize());    // Passport 초기화 (13강 표준 순서)
app.use(passport.session());       // 세션에서 req.user 복원

// Router 장착
app.use('/auth', authRouter);
app.use('/storages', storageRouter);
app.use('/ingredients', ingredientRouter);
app.use('/recipes', recipeRouter);

// 404 및 공통 에러 핸들러
app.use(notFound);
app.use(errorHandler);

app.listen(config.PORT, () => {
  console.log(`http://localhost:${config.PORT}에서 대기 중`);
});
