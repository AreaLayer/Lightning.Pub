import { Entity, PrimaryGeneratedColumn, Column, Index, Check, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./User.js"

@Entity()
export class UserReceivingInvoice {

    @PrimaryGeneratedColumn()
    serial_id: number

    @ManyToOne(type => User, { eager: true })
    @JoinColumn()
    user: User

    @Column()
    @Index({ unique: true })
    invoice: string

    @Column({ default: false })
    paid: boolean

    @Column()
    callbackUrl: string

    @Column({ default: 0 })
    settle_amount: number

    @Column()
    service_fee: number
}