import { z } from 'zod';

export const gradeSchema = z
  .string()
  .regex(
    /^([1-9]|1[0-1])$/,
    'Номер класса должен быть от 1 до 11, попробуйте еще раз:',
  )
  .transform((val) => parseInt(val));

export const nameSchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод, попробуйте еще раз:')
  .regex(
    /^[a-zA-Zа-яА-Я]+$/,
    'Можно использовать только русские или английские символы, попробуйте еще раз:',
  );

export const countrySchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод, попробуйте еще раз:');

export const regionSchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод, попробуйте еще раз:');

export const citySchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод, попробуйте еще раз:');

export const schoolSchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод, попробуйте еще раз:');

export const emailSchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод, попробуйте еще раз:')
  .email('Некорректный формат email, попробуйте еще раз:');

export const phoneSchema = z
  .string()
  .min(1)
  .max(20, 'Слишком длинный ввод')
  .regex(
    /^\+?[0-9]+$/,
    'Некорректный формат номера телефона, попробуйте еще раз:',
  );

export const teacherNameSchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод, попробуйте еще раз:')
  .regex(
    /^[a-zA-Zа-яА-Я\s]+$/,
    'Можно использовать только русские или английские символы и пробелы, попробуйте еще раз:',
  );

export const teacherContactSchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод');

export const teacherOrganizationSchema = z
  .string()
  .min(1)
  .max(255, 'Слишком длинный ввод');
