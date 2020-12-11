import { format } from 'date-fns';
import { belongsTo, hasMany, Model, Response, Server } from 'miragejs';

const students = require('./student.json');
const users = require('./user.json');
const courses = require('./course.json');
const studentCourses = require('./student_course.json');
const studentTypes = require('./student_type.json');
const courseTypes = require('./course_type.json');
const studentProfile = require('./student-profile.json');
const teachers = require('./teacher.json');
const sales = require('./sales.json');
const process = require('./process.json');

export default function makeServer({ environment = 'test' } = {}) {
  let server = new Server({
    environment,

    models: {
      user: Model,
      studentType: Model,
      student: Model.extend({
        studentCourses: hasMany(),
        type: belongsTo('studentType'),
      }),
      courseType: Model,
      course: Model.extend({
        type: belongsTo('courseType'),
        teacher: belongsTo(),
        sales: belongsTo(),
        process: belongsTo(),
      }),
      studentCourse: Model.extend({
        course: belongsTo(),
      }),
      studentProfile: Model.extend({
        studentCourses: hasMany(),
        type: belongsTo('studentType'),
      }),
      teacher: Model,
      sales: Model,
      process: Model,
    },

    seeds(server) {
      users.forEach((user) => server.create('user', user));
      teachers.forEach((teacher) => server.create('teacher', teacher));
      courseTypes.forEach((type) => server.create('courseType', type));
      sales.forEach((sale) => server.create('sale', sale));
      process.forEach(process => server.create('process', process));
      courses.forEach((course) => server.create('course', course));
      studentCourses.forEach((course) => server.create('studentCourse', course));
      studentTypes.forEach((type) => server.create('studentType', type));
      students.forEach((student) => server.create('student', student));
      studentProfile.forEach((student) => server.create('studentProfile', student));
    },

    routes() {
      this.passthrough((request) => {
        if (request.url === '/_next/static/development/_devPagesManifest.json') {
          return true;
        }
      });

      this.namespace = 'api';

      this.get('/login', (schema, request) => {
        const req = request.queryParams;
        const user = schema.users.where({
          email: req.email,
          password: req.password,
          type: req.loginType,
        });

        if (!!user.length) {
          return new Response(
            200,
            {},
            {
              data: {
                token: Math.random().toString(32).split('.')[1] + '~' + req.loginType,
                loginType: req.loginType,
              },
              code: 200,
              msg: 'login success',
            }
          );
        } else {
          return new Response(403, {}, { msg: 'Check user or email', code: 400 });
        }
      });

      this.get('/userType', (schema, req) => {
        const query = req.queryParams;
        const type = query.split('~')[1];

        if (!!type) {
          return new Response(200, {}, { data: type, msg: 'success', code: 200 });
        } else {
          return new Response(400, {}, { msg: 'Token is not exist', code: 400 });
        }
      });

      this.get('/students', (schema, req) => {
        const { query } = req.queryParams;
        const limit = +req.queryParams.limit;
        const page = +req.queryParams.page;
        const all = schema.students.all();
        let students = all.filter((item) => !query || item.name.includes(query)).models;
        const total = !query ? all.length : students.length;
        let data = { total, students };

        if (limit && page) {
          const start = limit * (page - 1);

          students = students.slice(start, start + limit);
          data = { ...data, paginator: { limit, page, total } };
        }

        students = students.map((student) => {
          const studentCourses = student.studentCourses;
          let courses = [];

          if (studentCourses.length) {
            courses = studentCourses.models.map((model) => {
              const name = model.course.name;

              return { name, id: +model.id };
            });
          }

          student.attrs.courses = courses;
          student.attrs.typeName = student.type.name;
          return student;
        });

        return new Response(200, {}, { data: { ...data, students }, msg: 'success', code: 200 });
      });

      this.post('/students/add', (schema, req) => {
        const body = JSON.parse(req.requestBody);
        const { name, email, area, type } = body;
        const data = schema.students.create({
          name,
          email,
          area,
          typeId: type,
          ctime: format(new Date(), 'yyyy-MM-dd hh:mm:ss'),
        });

        data.attrs.typeName = data.type.name;

        return new Response(200, {}, { msg: 'success', code: 200, data });
      });

      this.post('/students/update', (schema, req) => {
        const { id, email, name, area, type } = JSON.parse(req.requestBody);
        const target = schema.students.findBy({ id });

        if (target) {
          const data = target.update({
            email,
            name,
            area,
            typeId: type,
            updateAt: format(new Date(), 'yyyy-MM-dd hh:mm:ss'),
          });

          data.attrs.typeName = data.type.name;

          return new Response(200, {}, { msg: 'success', code: 200, data });
        } else {
          return new Response(400, {}, { msg: `can\'t find student by id ${id} `, code: 400 });
        }
      });

      this.delete('/students/delete', (schema, req) => {
        const id = +req.queryParams.id;

        schema.students.find(id).destroy();

        return new Response(200, {}, { data: true, msg: 'success', code: 200 });
      });

      this.post('/logout', (schema, _) => {
        return new Response(200, {}, { data: true, msg: 'success', code: 200 });
      });

      this.get('/student', (schema, req) => {
        const id = req.queryParams.id;
        const student = schema.studentProfiles.findBy({ id });
        const studentCourses = student.studentCourses;
        let courses = [];

        if (studentCourses.length) {
          courses = studentCourses.models.map((item) => {
            item.attrs.name = item.course.name;
            item.attrs.type = item.course.type.name;
            return item;
          });
        }

        student.attrs.courses = courses;
        student.attrs.typeName = student.type.name;

        if (student) {
          return new Response(200, {}, { msg: 'success', code: 200, data: student });
        } else {
          return new Response(400, {}, { msg: `can\'t find student by id ${id} `, code: 400 });
        }
      });

      this.get('/courses', (schema, req) => {
        const { page, limit } = req.queryParams;
        let courses = schema.courses.all().models;
        const total = courses.length;

        courses = courses.slice(page - 1, page * limit);

        courses.forEach((item) => {
          item.attrs.teacher = item.teacher.name;
        });

        if (courses) {
          return new Response(200, {}, { msg: 'success', code: 200, data: { total, courses } });
        } else {
          return new Response(500, {}, { msg: 'server error', code: 500 });
        }
      });

      this.get('/course', (schema, req) => { 
        const id = req.queryParams.id;
        const course = schema.courses.findBy({ id });

        course.attrs.teacher = course.teacher.name;
        course.attrs.sales = course.sales;
        course.attrs.typeName = course.type.name;
        course.attrs.process = course.process;

        if(!!course) {
          return new Response(200, {}, { msg: 'success', code: 200, data: course });
        } else {
          return new Response(400, {}, { msg: `can\'t find course by id ${id} `, code: 400 });
        }
      });
    },
  });

  return server;
}
