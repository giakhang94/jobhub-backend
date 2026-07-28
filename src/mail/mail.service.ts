import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}
  //gui mail xac thuc tai khoan
  async sendUserConfirmation(email: string, token: string, fullName?: string) {
    //1. get frontend url from env
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    //2. create confirmation url containing the token
    const confirmationUrl = `${frontendUrl}/auth/verify-email?token=${token}`;
    const userName = fullName || 'bạn';

    //3. send mail
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Xác thực tài khoản JobHub của bạn',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #007bff; text-align: center;">Chào mừng đến với JobHub!</h2>
            <p>Xin chào <strong>${userName}</strong>,</p>
            <p>Cảm ơn bạn đã đăng ký tài khoản trên hệ thống JobHub. Để hoàn tất quá trình đăng ký và kích hoạt tài khoản, vui lòng click vào nút bên dưới:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Xác Thực Tài Khoản
              </a>
            </div>

            <p style="font-size: 13px; color: #666;">
              <em>Lưu ý: Link này có hiệu lực trong vòng <strong>15 phút</strong>. Nếu link hết hạn, bạn có thể bấm nút "Gửi lại mail xác thực" trên giao diện ứng dụng.</em>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">
              Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
            </p>
          </div>
        `,
      });
    } catch (error) {
      console.error('Lỗi khi gửi mail xác thực:', error);
      throw new InternalServerErrorException(
        'Không thể gửi email xác thực. Vui lòng kiểm tra lại cấu hình mail server!',
      );
    }
  }
}
